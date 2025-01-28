import { Registry, collectDefaultMetrics, Counter } from 'prom-client';
import express from 'express';

const app = express();
const port = 9000;

// Create a Registry for custom metrics
const register = new Registry();

// Collect default Node.js metrics
collectDefaultMetrics({ register });

// Create custom metrics
const httpRequestCounter = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

register.registerMetric(httpRequestCounter);

// Middleware to collect HTTP metrics
app.use((req, res, next) => {
  res.on('finish', () => {
    httpRequestCounter.labels(req.method, req.route?.path || req.path, res.statusCode.toString()).inc();
  });
  next();
});

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.listen(port, () => {
  console.log(`App running on http://localhost:${port}`);
});
