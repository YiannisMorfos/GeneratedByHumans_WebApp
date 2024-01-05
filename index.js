import express from "express";
import axios from "axios";
import bodyParser from "body-parser";

const PORT = process.env.PORT || 3000;

const app = express()

let posts = [];

app.use(express.static("public"))

app.use(bodyParser.urlencoded({extended: true}))

function findPost(req, res, next) {
    const postId = parseInt(req.params.id);
    const postIndex = posts.findIndex(p => p.id === postId);


    if (postIndex === -1) {
        return res.status(404).send('Post not found');
    }
    // Attach the found post to the request object so it can be accessed in the next middleware/route handler
    req.post = posts[postIndex];
    req.postIndex = postIndex;
    next();
}

app.get("/", (req, res) => {
    res.render("index.ejs")
})

app.get("/blog", (req, res) => {
    res.render("blog.ejs")
})

app.get("/new", (req, res) => {
    res.render("new-post.ejs")
})

app.post("/new", (req, res) => {
    const post = {
        id : Date.now(),
        author: "Yiannis Morfos",
        title : req.body.title,
        content : req.body.content,
        datePosted : new Date()
    }
    posts.push(post)
    console.log(post)
    res.redirect(`/post/${post.id}`)
    })

app.get("/post/:id", findPost ,(req, res) => {
    res.render("post.ejs", {post: req.post})
})


app.listen(PORT, () => {
    console.log("Server running on port " + PORT)
})