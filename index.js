import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import pg from "pg";
import multer from "multer";
import path from 'path';
import dotenv from 'dotenv';
import session from 'express-session';
import bcrypt from 'bcrypt';

dotenv.config();

const db = new pg.Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

const PORT = process.env.PORT || 3000;

const app = express()

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true
}));

app.use(express.static("public"))

app.use(bodyParser.urlencoded({extended: true}))

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'public/uploads/'); // make sure this folder exists
    },
    filename: function(req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

function authorize(allowedRoles) {
    return async (req, res, next) => {
        if (req.session && req.session.user) {
            try {
                const userId = req.session.user.id;
                const userQuery = 'SELECT role FROM users WHERE id = $1';
                const { rows } = await db.query(userQuery, [userId]);

                if (rows.length > 0 && allowedRoles.includes(rows[0].role)) {
                    return next();
                } else {
                    return res.status(403).send("Access denied");
                }
            } catch (error) {
                console.error('Authorization error:', error);
                return res.status(500).send("Internal Server Error");
            }
        } else {
            return res.status(403).send("Access denied");
        }
    };
}


const upload = multer({ storage: storage });

app.get("/", (req, res) => {
    res.render("index.ejs")
})

app.get("/blog", (req, res) => {
    res.render("blog.ejs")
})

app.get('/register', (req, res) => {
    res.render('register.ejs'); // Ensure there's a register.ejs file in your views directory
});


app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    try {
        // Check if email already exists
        const emailCheckQuery = 'SELECT * FROM users WHERE email = $1';
        const emailCheckResult = await db.query(emailCheckQuery, [email]);

        if (emailCheckResult.rows.length > 0) {
            return res.status(400).send('Email already in use');
        }

        // Check if username already exists
        const usernameCheckQuery = 'SELECT * FROM users WHERE username = $1';
        const usernameCheckResult = await db.query(usernameCheckQuery, [username]);

        if (usernameCheckResult.rows.length > 0) {
            return res.status(400).send('Username already in use');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user into database
        const insertUserQuery = 'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4)';
        await db.query(insertUserQuery, [username, email, hashedPassword, 'user']); // Default role is 'user'

        res.redirect('/login'); // Redirect to login page after successful registration
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).send('An error occurred during registration');
    }
});


app.get('/login', (req, res) => {
    res.render('login.ejs', { session: req.session }); // Make sure you have a login.ejs file in your views directory
});


app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Check if user exists
        const userQuery = 'SELECT * FROM users WHERE username = $1';
        const { rows } = await db.query(userQuery, [username]);

        if (rows.length > 0) {
            const user = rows[0];

            // Verify the password
            const isValid = await bcrypt.compare(password, user.password);

            if (isValid) {
                // Set user info in session
                req.session.user = { id: user.id, role: user.role };
                res.redirect('/');
            } else {
                res.send('Invalid username or password');
            }
        } else {
            res.send('Invalid username or password');
        }
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).send('An error occurred during login');
    }
});

app.get('/logout', (req, res) => {
    if (req.session) {
        req.session.destroy(err => {
            if (err) {
                // handle error
            } else {
                res.redirect('/login');
            }
        });
    }
});


app.get("/new", authorize(['admin', 'author']), (req, res) => {
    res.render("new-post.ejs")
})

app.post("/new", authorize(['admin', 'author']), upload.single('FeaturedImage'), (req, res) => {
    const title = req.body.title;
    const content = req.body.content;
    const featuredImage = req.file ? req.file.filename : null; // Assuming multer is used
    console.log(featuredImage)
    const author = "Ioanna"; // This can also be dynamic based on user session or input
    const datePosted = new Date();

    const query = "INSERT INTO posts (title, content, featuredimage, author, dateposted) VALUES ($1, $2, $3, $4, $5) RETURNING id";
    const values = [title, content, featuredImage, author, datePosted];

    db.query(query, values, (err, dbRes) => {
        if (err) {
            console.error("Error executing query", err.stack);
            // Handle the error appropriately
            res.status(500).send("An error occurred");
        } else {
            const postId = dbRes.rows[0].id;
            res.redirect(`/post/${postId}`);
        }
    });
});


app.get("/post/:id", authorize(['admin', 'author']), (req, res) => {
    const postId = req.params.id;
    const query = "SELECT * FROM posts WHERE id = $1";
    const values = [postId];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error("Error executing query", err.stack);
            res.status(500).send("An error occurred while fetching the post");
        } else {
            if (result.rows.length > 0) {
                const post = result.rows[0];

                res.render("post.ejs", { post: post }); // Assuming 'post.ejs' is your template
            } else {
                res.status(404).send("Post not found");
            }
        }
    })
})

app.get("/edit-post/:id", (req, res) => {
    const postId = req.params.id;
    const query = "SELECT * FROM posts WHERE id = $1";

    db.query(query, [postId], (err, result) => {
        if (err) {
            console.error("Error executing query", err.stack);
            res.status(500).send("An error occurred");
        } else {
            if (result.rows.length > 0) {
                const post = result.rows[0];
                res.render("new-post.ejs", { post: post });
            } else {
                res.status(404).send("Post not found");
            }
        }
    });
});


app.post("/edit-post/:id", authorize(['admin', 'author']), upload.single('FeaturedImage'), (req, res) => {
    const postId = req.params.id;
    const title = req.body.title;
    const content = req.body.content;
    const featuredImage = req.file ? req.file.filename : null; // Assuming multer is used for image upload

    const query = "UPDATE posts SET title = $1, content = $2, featuredimage = $3 WHERE id = $4";
    const values = [title, content, featuredImage, postId];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error("Error executing query", err.stack);
            res.status(500).send("An error occurred");
        } else {
            res.redirect(`/post/${postId}`);
        }
    });
});




app.get("/contact", (req, res) => {
    res.render("contact.ejs")
})

app.post("/contact",(req, res) => {
    const name = req.body.name
    const email = req.body.email
    const message = req.body.message
    db.connect()
    db.query("INSERT INTO contact (name, email, message) VALUES ($1, $2, $3)", [name, email, message], (err, res) => {
        if (err) {
            console.error("Error executing query", err.stack)
        }
    }
    );
    res.redirect("/")
    db.end();
});


app.listen(PORT, () => {
    console.log("Server running on port " + PORT)
})