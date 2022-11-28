const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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
        const paymentsCollection = client.db('heavyWheel').collection('payments');

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
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1d' })
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

        app.get('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const orders = await myOrdersList.findOne(query);
            res.send(orders);
        })
        // buyers section api's

        // users
        app.get('/users', async (req, res) => {
            const query = {};
            const users = await usersCollections.find(query).toArray();
            res.send(users);
        });

        app.post('/users', async(req, res) => {
            const user = req.body;
            const result = await usersCollections.insertOne(user);
            res.send(result);
        });
        // users

        // users categories
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollections.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' });
        });
        app.get('/users/buyer/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollections.findOne(query);
            res.send({ isBuyer: user?.role === 'buyer' });
        });
        app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollections.findOne(query);
            res.send({ isSeller: user?.role === 'seller' });
        });
        // users categories

        // get buyers/sellers
        app.get('/users/:role', async (req, res) => {
            const role = req.params.role;
            const query = { role }
            const specificUser = await usersCollections.find(query).toArray();
            res.send(specificUser);
        });

        // delete users
        app.delete('/users/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await usersCollections.deleteOne(filter);
            res.send(result);
        })

        // add products
        app.post("/addProduct", verifyJWT, async (req, res) => {
            const addProduct = req.body;
            const result = await products.insertOne(addProduct);
            res.send(result);
        });

        // get products
        app.get('/addProduct', async (req, res) => {
            const query = {};
            const products = await products.find(query).toArray();
            res.send(products);
        });

        app.get("/addProduct/:user_id", async (req, res) => {
            const user_id = req.params.user_id;
            const query = {user_id:user_id};
            const cursor = products.find(query);
            const allProducts = await cursor.toArray();
            res.send(allProducts);
        });

        // delete product
        app.delete('/addProduct/:id',verifyJWT, async(req,res)=>{
            const id = req.params.id;
            const filter = {
              _id: ObjectId(id)
            };
            const result = await products.deleteOne(filter);
            res.send(result);
        });

        // advertise product
        app.put('/addProduct/seller/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    adsStatus: 'advertised'
                }
            }
            const result = await products.updateOne(filter, updatedDoc, options);
            res.send(result);
        });

        app.get("/addProduct/seller/:adsStatus", async (req, res) => {
            const adsStatus = req.params.adsStatus;
            const query = {adsStatus:adsStatus};
            const cursor = products.find(query);
            const sellerProducts = await cursor.toArray();
            res.send(sellerProducts);
          });

        // verify seller
        app.put('/users/admin/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    status: 'verified'
                }
            }
            const result = await usersCollections.updateOne(filter, updatedDoc, options);
            res.send(result);
        });

        // payment
        app.post('/create-payment-intent', async (req, res) => {
            const orders = req.body;
            const price = orders.resalePrice;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ]
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        }); 

        app.post('/payments', async (req, res) =>{
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);
            const id = payment.ordersId
            const filter = {_id: ObjectId(id)}
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const updatedResult = await myOrdersList.updateOne(filter, updatedDoc)
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