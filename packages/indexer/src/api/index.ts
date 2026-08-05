import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { client, graphql } from "ponder";

const app = new Hono();

app.use("/sql/*", client({ db: db as never, schema }));
app.use("/", graphql({ db: db as never, schema }));
app.use("/graphql", graphql({ db: db as never, schema }));

export default app;
