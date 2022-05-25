const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;
const app = express();
const jwt = require("jsonwebtoken");
const { get } = require("express/lib/response");
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.n5kon.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

//
//
//JWT verify
//
//
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}
console.log(uri);
console.log("db connected");
async function run() {
  try {
    await client.connect();
    const userCollection = client.db("tools_portal").collection("users");
    const toolsCollection = client.db("tools_portal").collection("tools");
    const orderCollection = client.db("tools_portal").collection("orders");

    //
    //
    // Operations on users Route
    //
    //

    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign({ email: email }, process.env.SECRET_TOKEN, {
        expiresIn: "4h",
      });
      console.log(token);
      res.send({ result, accessToken: token });
    });
    //
    //
    //
    // operation on tools route
    //
    //
    //
    app.get("/tools", async (req, res) => {
      const query = {};
      const cursor = toolsCollection.find(query);
      const tools = await cursor.toArray();
      res.send(tools);
    });
    app.get("/tools/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const details = await toolsCollection.findOne(query);
      res.send(details);
    });
    app.patch("/tools/:id", async (req, res) => {
      const id = req.params.id;
      const quantity = req.body;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: { orderQuantity: quantity },
      };
      const updatedBooking = await orderCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(updatedBooking);
    });
    //
    //
    //
    // Operations on orders route
    //
    //
    //
    app.get("/orders/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const orders = await orderCollection.find(query).toArray();
      res.send(orders);
    });

    app.post("/orders", async (req, res) => {
      const order = req.body;
      const query = {
        tool: order.tool,
        email: order.email,
      };
      const exists = await orderCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, tool: exists });
      }
      const result = await orderCollection.insertOne(order);
      return res.send({ success: true, result });
    });

    app.get("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const orders = await orderCollection.findOne(query).toArray();
      res.send(orders);
    });
    app.get("/orders", async (req, res) => {
      const result = await orderCollection.find().toArray();
      res.send(result);
    });
  } finally {
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Gadget manufacturer sites server is running");
});

app.listen(port, () => {
  console.log("server is running on port", port);
});
