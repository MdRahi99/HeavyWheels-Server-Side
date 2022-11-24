const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000;

const app = express();

// middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yaqgjrz.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run(){
    try{
        const categoriesList = client.db('heavyWheel').collection('categories');

        app.get('/categories', async(req, res) => {
            const query = {};
            const list = await categoriesList.find(query).toArray();
            res.send(list);
        })
    }
    finally{

    }
}
run().catch(console.log);


app.get('/', async (req, res) => {
    res.send('Heavy Wheel server is running');
})

app.listen(port, () => console.log(`Heavy Wheel running on ${port}`))