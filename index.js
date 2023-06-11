const express = require('express')
const cors = require('cors');
require('dotenv').config()
const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000

// middle ware
app.use(cors())
app.use(express.json())

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
    const classFeedbackCollection =client.db('drawingSchool').collection('classFeedbacks');

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
    app.get('/classes', async(req,res)=>{
      const email = req.query.email;
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



    // class feedback related api
    app.post('/feedbacks',async(req,res)=>{
      const feedback=req.body;
      const query ={_id: feedback._id}
      const existingFeedback= await classFeedbackCollection.findOne(query)
      if(existingFeedback){
        return res.send({message:'you all already send the feedback'})
      }
      const result =await classFeedbackCollection.insertOne(feedback);
      res.send(result)
    })




    // create payment intent
    app.post('/create-payment-intent', async (req, res) => {
      const {price}  = req.body;
      console.log(price)
      const amount = parseInt(price * 100);
      console.log(price,amount)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
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