import { RepoFile } from '../github/repoFetcher';
import { Signal, EventSignalData } from './types';

/**
 * Event Scanner
 * 
 * Detects event producers and consumers:
 * - .emit() / .publish()
 * - .on() / .subscribe()
 * - @KafkaListener
 * - Sidekiq::Worker
 */

export function scanEvents(file: RepoFile): Signal[] {
  const signals: Signal[] = [];
  const content = file.content;

  // 1. Detect event emitters: .emit('EVENT_NAME', data)
  const emitPattern = /\.emit\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  let match;
  while ((match = emitPattern.exec(content)) !== null) {
    const eventName = match[1];

    signals.push({
      type: 'event',
      data: {
        name: eventName,
        role: 'producer'
      } as EventSignalData,
      file: file.path,
      confidence: 0.95
    });
  }

  // 2. Detect event publishers: .publish('EVENT_NAME', data)
  const publishPattern = /\.publish\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  while ((match = publishPattern.exec(content)) !== null) {
    const eventName = match[1];

    signals.push({
      type: 'event',
      data: {
        name: eventName,
        role: 'producer'
      } as EventSignalData,
      file: file.path,
      confidence: 0.95
    });
  }

  // 3. Detect event listeners: .on('EVENT_NAME', handler)
  const onPattern = /\.on\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  while ((match = onPattern.exec(content)) !== null) {
    const eventName = match[1];

    signals.push({
      type: 'event',
      data: {
        name: eventName,
        role: 'consumer'
      } as EventSignalData,
      file: file.path,
      confidence: 0.9
    });
  }

  // 4. Detect event subscribers: .subscribe('EVENT_NAME', handler)
  const subscribePattern = /\.subscribe\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  while ((match = subscribePattern.exec(content)) !== null) {
    const eventName = match[1];

    signals.push({
      type: 'event',
      data: {
        name: eventName,
        role: 'consumer'
      } as EventSignalData,
      file: file.path,
      confidence: 0.9
    });
  }

  // 5. Detect Kafka listeners: @KafkaListener(topics = "topic-name")
  const kafkaListenerPattern = /@KafkaListener\s*\([^)]*topics\s*=\s*['"`]([^'"`]+)['"`]/gi;
  while ((match = kafkaListenerPattern.exec(content)) !== null) {
    const topic = match[1];

    signals.push({
      type: 'event',
      data: {
        name: topic,
        role: 'consumer'
      } as EventSignalData,
      file: file.path,
      confidence: 0.95
    });
  }

  // 6. Detect Sidekiq workers: class MyWorker < Sidekiq::Worker
  const sidekiqPattern = /class\s+(\w+)\s*<\s*Sidekiq::Worker/gi;
  while ((match = sidekiqPattern.exec(content)) !== null) {
    const workerName = match[1];

    signals.push({
      type: 'event',
      data: {
        name: workerName,
        role: 'consumer'
      } as EventSignalData,
      file: file.path,
      confidence: 0.9
    });
  }

  // 7. Detect RabbitMQ/AMQP: channel.publish('exchange', 'routing-key', ...)
  const rabbitmqPattern = /\.publish\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]/gi;
  while ((match = rabbitmqPattern.exec(content)) !== null) {
    const exchange = match[1];
    const routingKey = match[2];

    signals.push({
      type: 'event',
      data: {
        name: `${exchange}.${routingKey}`,
        role: 'producer'
      } as EventSignalData,
      file: file.path,
      confidence: 0.85
    });
  }

  return signals;
}
