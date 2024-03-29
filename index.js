const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;
const app = express();
const jwt = require("jsonwebtoken");
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
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.SECRET_TOKEN, (err, decoded) => {
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
    const paymentCollection = client.db("tools_portal").collection("payments");
    const reviewCollection = client.db("tools_portal").collection("reviews");
    const profileCollection = client.db("tools_portal").collection("profile");
    const infoCollection = client.db("tools_portal").collection("info");

    //
    //
    //  Verify Admin
    //
    //
    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "forbidden" });
      }
    };

    //
    //
    // Operations on users Route
    //
    //
    app.get("/users", verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });
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

    app.put("/users/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        const filter = { email: email };
        const updateDoc = {
          $set: { role: "admin" },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      } else {
        res.status(403).send({ message: "forbidden" });
      }
    });

    app.get("/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });

    app.delete("/users/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await userCollection.deleteOne(filter);
      res.send(result);
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
    app.get("/tools/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const details = await toolsCollection.findOne(query);
      res.send(details);
    });
    app.post("/tools", verifyJWT, async (req, res) => {
      const tools = req.body;
      const result = await toolsCollection.insertOne(tools);
      res.send(result);
    });
    app.patch("/tools/:id", verifyJWT, async (req, res) => {
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

    app.delete("/tools/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await toolsCollection.deleteOne(filter);
      res.send(result);
    });
    //
    //
    //
    // Operations on orders route
    //
    //
    //
    app.get("/orders", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (email) {
        const query = { email: email };
        const orders = await orderCollection.find(query).toArray();
        return res.send(orders);
      } else {
        return res.status(403).send({ message: "forbidden access" });
      }
    });
    app.get("/orders/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const orders = await orderCollection.findOne(query);
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

    app.patch("/orders/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };

      const result = await paymentCollection.insertOne(payment);
      const updatedOrders = await orderCollection.updateOne(filter, updatedDoc);
      res.send(updatedOrders);
    });

    //
    //
    // Paid orders
    //
    //
    app.get("/paidOrders", verifyJWT, verifyAdmin, async (req, res) => {
      const orders = await orderCollection.find({ paid: true }).toArray();
      return res.send(orders);
    });
    //
    //
    // Delete Paid orders
    //
    //
    app.delete("/paidOrders/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await orderCollection.deleteOne(filter);
      res.send(result);
    });

    //
    //
    // All orders
    //
    //
    app.get("/allOrders", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await orderCollection.find().toArray();
      res.send(result);
    });

    app.delete("/orders/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await orderCollection.deleteOne(filter);
      res.send(result);
    });

    //
    //
    //
    //Operations On Payment Section

    app.post("/create-payment", verifyJWT, async (req, res) => {
      const order = req.body;
      const price = order.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    //
    //
    // Get Reviews
    //
    //
    app.get("/reviews", async (req, res) => {
      const reviews = await reviewCollection.find().toArray();
      res.send(reviews);
    });

    app.post("/reviews", verifyJWT, async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });

    // Get Profile Data
    app.get("/profile", async (req, res) => {
      const users = await profileCollection.find().toArray();
      res.send(users);
    });

    app.post("/profile", verifyJWT, async (req, res) => {
      const order = req.body;
      const query = {
        email: order.email,
      };
      const exists = await profileCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, tool: exists });
      }
      const result = await profileCollection.insertOne(order);
      return res.send({ success: true, result });
    });

    app.delete("/profile/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await profileCollection.deleteOne(filter);
      res.send(result);
    });

    //Operation on dealers info route
    app.get("/info", verifyJWT, verifyAdmin, async (req, res) => {
      const info = await infoCollection.find().toArray();
      res.send(info);
    });

    app.post("/info", verifyJWT, async (req, res) => {
      const info = req.body;
      const result = await infoCollection.insertOne(info);
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
