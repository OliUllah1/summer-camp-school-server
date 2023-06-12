const express = require('express')
const cors = require('cors');
require('dotenv').config()
const app = express()
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000

// middle ware
app.use(cors())
app.use(express.json())

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.s5nou2l.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection= client.db('drawingSchool').collection('users');
    const classesCollection =client.db('drawingSchool').collection('classes');
    const saveClassesCollection =client.db('drawingSchool').collection('saveClasses');
    const paymentsCollection =client.db('drawingSchool').collection('payments');

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

      res.send({ token })
    })


    // user related api
    app.get('/allusers',async(req,res)=>{
      const result =await usersCollection.find().toArray()
      res.send(result)
    })
    app.get('/users',async(req,res)=>{
      const email = req.query.email
        const query={email:email}
        const result=await usersCollection.findOne(query)
        res.send(result)
    })
    app.post('/users',async(req,res)=>{
        const user = req.body;
        const query={email:user.email,name:user.name};
        const existingUser = await usersCollection.findOne(query)
        if(existingUser){
            return res.send({message:'user already register'})
        }
        const result = await usersCollection.insertOne(user)
        res.send(result)
    })
    app.patch('/users/:id',async(req,res)=>{
      const id = req.params.id;
      const role=req.query.role;
      const filter= {_id: new ObjectId(id)}
      if(role==='admin'){
        const updateDoc = {
          $set: {
            role: 'admin'
          },
        };
        const result = await usersCollection.updateOne(filter,updateDoc)
        res.send(result)
      }
      else{
        const updateDoc = {
          $set: {
            role: 'instructor'
          },
        };
        const result = await usersCollection.updateOne(filter,updateDoc)
        res.send(result)
      }
     
    })

    // instructor related api
    app.get('/instructors', async(req,res)=>{
      const query={role:'instructor'}
      const result=await usersCollection.find(query).toArray();
      res.send(result)
    })

    // classes related api
    app.get('/allclasses',async(req,res)=>{
      const result= await classesCollection.find().toArray()
      res.send(result)
    })
    app.get('/approvedclasses', async(req,res)=>{
      const query={status:'approved'}
      const result= await classesCollection.find(query).toArray();
      res.send(result)
    })
    app.get('/classes/:id',async(req,res)=>{
      const id=req.params.id;
      const query={_id: new ObjectId(id)}
      const result=await classesCollection.findOne(query)
      res.send(result)
    })
    app.get('/classes', verifyJWT, async(req,res)=>{
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }

      const query={instructorEmail:email}
      const result = await classesCollection.find(query).toArray()
      res.send(result)
    })

    app.post('/classes',async(req,res)=>{
      const classInfo = req.body;
      const result=await classesCollection.insertOne(classInfo);
      res.send(result)
    })
    app.put('/classes/:id',async(req,res)=>{
      const id =req.params.id;
      const updateData=req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          className: updateData.className,
          availableSets:updateData.availableSets,
          price:updateData.price
        },
      };
      const result = await classesCollection.updateOne(filter,updateDoc)
      res.send(result)
    })
    app.patch('/classfeedback/:id',async(req,res)=>{
      const id =req.params.id;
      const feedback=req.body;
      const filter = {_id : new ObjectId(id)}
      const updateDoc = {
        $set: {
          feedback: feedback.feedback
        },
      };
      const result= await classesCollection.updateOne(filter,updateDoc)
      res.send(result)
    })
    app.patch('/classes/:id',async(req,res)=>{
      const id=req.params.id;
      const status=req.query.status;
      const filter = { _id: new ObjectId(id) };
      if(status === 'approved'){
      const updateDoc = {
        $set: {
          status: 'approved'
        },
      };
      const result= await classesCollection.updateOne(filter,updateDoc)
      res.send(result)
      }
      else{
        const updateDoc = {
          $set: {
            status: 'denied'
          },
        };
        const result= await classesCollection.updateOne(filter,updateDoc)
        res.send(result)
      }
      
    })

    // save class related api
    app.get('/saveclass',async(req,res)=>{
      const result = await saveClassesCollection.find().toArray()
      res.send(result)
    })
    app.get('/saveclass/:id',async(req,res)=>{
      const id=req.params.id;
      const query = { _id : id}
      const result= await saveClassesCollection.findOne(query)
      res.send(result)
    })
    app.post('/saveclass', async(req,res)=>{
      const saveClass = req.body;
      const query ={_id:saveClass._id,email:saveClass.email}
      const existingClass = await saveClassesCollection.findOne(query)
      if(existingClass){
        return res.send({message:'already save the class'})
      }
      const result = await saveClassesCollection.insertOne(saveClass)
      res.send(result)
    })
    app.delete('/saveclass/:id',async(req,res)=>{
      const id= req.params.id;
      const email=req.query.email;
      const query = { _id: id,email:email };
      const result = await saveClassesCollection.deleteOne(query)
      res.send(result)
    })


    // create payment intent
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })


    // payments related api
    app.get('/payments',verifyJWT, async(req,res)=>{
      const email =req.query.email;
      const query = {userEmail:email}
      const result =await paymentsCollection.find(query).toArray()
      res.send(result)
    })
    app.post('/payments', verifyJWT, async(req,res)=>{
      const id = req.query.id;
      const paymentsData =  req.body;
      const query ={_id : id}
      const filter = {_id: new ObjectId(id)}
      const deleteSaveCard = await saveClassesCollection.deleteOne(query)
      const classInformation= await classesCollection.findOne(filter)
      const availableSets=classInformation.availableSets
      const TotalEnrolledStudents=classInformation.TotalEnrolledStudents;
      const updateDoc = {
        $set: {
          TotalEnrolledStudents: TotalEnrolledStudents + 1,
          availableSets: availableSets -1
        },
      };
      const updateDocuments= classesCollection.updateOne(filter,updateDoc)
      const result =await paymentsCollection.insertOne(paymentsData);
      res.send(result)

    })



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);






app.get('/', (req, res) => {
    res.send('summer-camp-school is running')
  })
  
  app.listen(port, () =>  {
    console.log(`summer-camp-school on port ${port}`)
  })