const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;

const app = express();

// middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yaqgjrz.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorized access');
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    })

}

async function run(){
    try{
        const categoriesList = client.db('heavyWheel').collection('categories');
        const products = client.db('heavyWheel').collection('allProducts');
        const myOrdersList = client.db('heavyWheel').collection('myOrdersList');
        const usersCollections = client.db('heavyWheel').collection('users');

        app.get('/categories', async(req, res) => {
            const query = {};
            const list = await categoriesList.find(query).toArray();
            res.send(list);
        })

        app.get('/products/:category_id',async (req,res)=>{
            const category_id = req.params.category_id;
            const query = {category_id: category_id};
            const allProducts = await products.find(query).toArray();
            res.send(allProducts);
          });

        // jwt
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollections.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
                return res.send({ accessToken: token });
            }
            res.status(403).send({ accessToken: '' })
        });

        // buyers section api's
        app.get('/orders', verifyJWT, async(req, res) => {
            const email=req.query.email;
            const decodedEmail=req.decoded.email;
            if(email !== decodedEmail){
                return res.status(403).send({message: "forbidden access"});
            }
            const query={email:email};
            const orders=await myOrdersList.find(query).toArray();
            res.send(orders);
        });

        app.post('/orders', async (req, res) => {
            const orders = req.body;
            const query = {
                name: orders.name,
                email: orders.email,
                itemName: orders.itemName,
                resalePrice: orders.resalePrice,
                phone: orders.phone,
                price: orders.price,
            }

            const alreadyOrdered = await myOrdersList.find(query).toArray();

            if (alreadyOrdered.length) {
                const message = `You already selected ${alreadyOrdered.name}`
                return res.send({ acknowledged: false, message })
            }

            const result = await myOrdersList.insertOne(orders);
            res.send(result);
        });

        // users
        app.get('/users', async (req, res) => {
            const query = {};
            const users = await usersCollections.find(query).toArray();
            res.send(users);
        });

        // app.get('/users/admin/:email', async (req, res) => {
        //     const email = req.params.email;
        //     const query = { email }
        //     const user = await usersCollections.findOne(query);
        //     res.send({ isAdmin: user?.role === 'admin' });
        // })

        app.post('/users', async(req, res) => {
            const user = req.body;
            const result = await usersCollections.insertOne(user);
            res.send(result);
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