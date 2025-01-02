import { ApolloClient, InMemoryCache } from "@apollo/client";

const apolloClient = new ApolloClient({
  uri: "https://api.studio.thegraph.com/query/99814/abraham/v0.0.2",
  cache: new InMemoryCache(),
});

export default apolloClient;
