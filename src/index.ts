import http from 'http'
import compression from 'compression'
import cors from 'cors'
import debug from 'debug'
import helmet from 'helmet'
import _ from 'lodash'
import express from 'express'

const logger = debug('api:index')

const port = process.env.PORT ?? 4444

const app = express()

app.use(compression())

app.use(helmet())

// MIGRATION: consider using `strict: true `
app.use(express.json({ limit: '1mb' }))

// MIGRATION: where do we use url-encoded requests?
app.use(express.urlencoded({ extended: true }))

app.use(cors({ exposedHeaders: ['Location'] }))

app.get('/', (req, res, next) => res.send('Hello World 2'))

app.use((error, req, res, next) => {
  const errors = [_.pick(error, ['message', 'code', 'state'])]

  return res.status(error.code || 500).json({ errors })
})

const server = http.createServer(app)

server.listen(port, () => {
  logger(`server listening on ${port}`)
})
