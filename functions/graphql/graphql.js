const { ApolloServer, gql } = require("apollo-server-lambda")
const superagent = require("superagent")
const { DOMParser } = require("xmldom")
const tj = require("@mapbox/togeojson")

const URL = "https://pristrak.000webhostapp.com/wifi.php"

// Construct a schema, using GraphQL schema language
const typeDefs = gql`
  scalar DateTime
  scalar Coordinates
  type PointGeometry {
    type: String!
    coordinates: Coordinates!
  }
  type PointProps {
    ssid: String
    mac: String
    capabilities: String
    channel: Int
    maxrssi: Int
    privacy: Boolean
    type: String
    lastseen: DateTime
    hdop: Int
  }
  type PointObject {
    type: String!
    geometry: PointGeometry
    properties: PointProps
  }
  type FeatureCollection {
    type: String!
    features: [PointObject]
  }
  type Query {
    list: FeatureCollection
  }
`

// Provide resolver functions for your schema fields
const resolvers = {
  Query: {
    list: () => {
      const getKml = async () => {
        try {
          const res = await superagent.get(URL)
          return res.text
        } catch (err) {
          return err
        }
      }

      const toGeoJson = async () => {
        const kml = new DOMParser().parseFromString(await getKml())
        const geojson = tj.kml(kml)
        // const geojsonWithStyles = tj.kml(kml, { styles: true })

        const fixed = geojson.features.map(feature => {
          return {
            ...feature,
            properties: {
              // ...feature.properties,
              ssid: feature.properties.description
                .split("<br>")[0]
                .split(":")[1]
                .trim(),
              mac: feature.properties.description
                .split("<br>")[1]
                .split(":")[1]
                .trim(),
              capabilities: feature.properties.description
                .split("<br>")[2]
                .split(":")[1]
                .trim(),
              channel: Number(
                feature.properties.description.split("<br>")[3].split(":")[1]
              ),
              maxrssi: Number(
                feature.properties.description.split("<br>")[4].split(":")[1]
              ),
              privacy:
                feature.properties.description
                  .split("<br>")[5]
                  .split(":")[1]
                  .trim() === "On",
              type: feature.properties.description
                .split("<br>")[6]
                .split(":")[1]
                .trim(),
              lastseen: Number(
                feature.properties.description.split("<br>")[7].split(":")[1]
              ),
              hdop: Number(
                feature.properties.description.split("<br>")[8].split(":")[1]
              ),
            },
          }
        })
        console.log(JSON.stringify(fixed, null, 2))
        return { type: "FeatureCollection", features: fixed }
      }
      return toGeoJson()
    },
  },
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
  playground: true,
})

exports.handler = server.createHandler()
