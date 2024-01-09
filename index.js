import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import pg from "pg";
import multer from "multer";
import path from 'path';
import dotenv from 'dotenv';

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

const upload = multer({ storage: storage });

app.get("/", (req, res) => {
    res.render("index.ejs")
})

app.get("/blog", (req, res) => {
    res.render("blog.ejs")
})

app.get("/new", (req, res) => {
    res.render("new-post.ejs")
})

app.post("/new", upload.single('FeaturedImage'), (req, res) => {
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


app.get("/post/:id",(req, res) => {
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


app.post("/edit-post/:id", upload.single('FeaturedImage'), (req, res) => {
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