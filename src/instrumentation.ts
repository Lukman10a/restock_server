import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';

// 1. Open a secret backdoor port (55674) for Prometheus to scrape data from
const prometheusExporter = new PrometheusExporter({
  port: 55674,
  endpoint: '/metrics',
});

// 2. Set up the tracking software
const sdk = new NodeSDK({
  metricReader: prometheusExporter,
  // This line auto-detects Express/Fastify routes and Mongoose/MongoDB queries!
  instrumentations: [getNodeAutoInstrumentations()],
});

// 3. Start tracking
sdk.start();
console.log('📊 OpenTelemetry tracking is live on port 55674');
