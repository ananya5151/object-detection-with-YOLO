// performance-monitor.js
// Real-time performance monitoring system for WebRTC Object Detection

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      detectionLatencies: [],
      frameProcessingTimes: [],
      webrtcStats: {
        bitrateUpload: [],
        bitrateDownload: [],
        packetsLost: 0,
        jitter: []
      },
      systemStats: {
        memoryUsage: [],
        cpuUsage: []
      },
      detectionStats: {
        totalFramesProcessed: 0,
        detectionsPerSecond: 0,
        averageObjectsDetected: 0
      },
      startTime: Date.now(),
      lastSaveTime: Date.now()
    };
    
    this.isMonitoring = false;
    this.saveInterval = 10000; // Save every 10 seconds
    this.maxDataPoints = 1000; // Keep last 1000 data points
    
    this.setupAutoSave();
    this.setupPerformanceObserver();
  }

  // Start monitoring
  start() {
    console.log('🔍 Performance monitoring started');
    this.isMonitoring = true;
    this.metrics.startTime = Date.now();
    this.startSystemMonitoring();
  }

  // Stop monitoring
  stop() {
    console.log('🛑 Performance monitoring stopped');
    this.isMonitoring = false;
    this.saveMetrics();
  }

  // Record detection latency (time from frame capture to result)
  recordDetectionLatency(startTime, endTime) {
    if (!this.isMonitoring) return;
    
    const latency = endTime - startTime;
    this.metrics.detectionLatencies.push({
      timestamp: Date.now(),
      latency: latency
    });
    
    this.trimArray(this.metrics.detectionLatencies);
    
    // Update detection stats
    this.metrics.detectionStats.totalFramesProcessed++;
    this.updateDetectionRate();
  }

  // Record frame processing time
  recordFrameProcessing(processingTime, objectCount = 0) {
    if (!this.isMonitoring) return;
    
    this.metrics.frameProcessingTimes.push({
      timestamp: Date.now(),
      processingTime: processingTime,
      objectCount: objectCount
    });
    
    this.trimArray(this.metrics.frameProcessingTimes);
    
    // Update average objects detected
    this.updateAverageObjects(objectCount);
  }

  // Record WebRTC statistics
  recordWebRTCStats(stats) {
    if (!this.isMonitoring || !stats) return;
    
    const timestamp = Date.now();
    
    // Extract relevant WebRTC stats
    if (stats.bytesReceived !== undefined) {
      this.metrics.webrtcStats.bitrateDownload.push({
        timestamp: timestamp,
        bytes: stats.bytesReceived
      });
    }
    
    if (stats.bytesSent !== undefined) {
      this.metrics.webrtcStats.bitrateUpload.push({
        timestamp: timestamp,
        bytes: stats.bytesSent
      });
    }
    
    if (stats.packetsLost !== undefined) {
      this.metrics.webrtcStats.packetsLost += stats.packetsLost;
    }
    
    if (stats.jitter !== undefined) {
      this.metrics.webrtcStats.jitter.push({
        timestamp: timestamp,
        jitter: stats.jitter
      });
    }
    
    this.trimArray(this.metrics.webrtcStats.bitrateDownload);
    this.trimArray(this.metrics.webrtcStats.bitrateUpload);
    this.trimArray(this.metrics.webrtcStats.jitter);
  }

  // Record system performance
  recordSystemStats() {
    if (!this.isMonitoring) return;
    
    const timestamp = Date.now();
    
    // Memory usage
    if (performance.memory) {
      this.metrics.systemStats.memoryUsage.push({
        timestamp: timestamp,
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      });
    }
    
    this.trimArray(this.metrics.systemStats.memoryUsage);
  }

  // Calculate current metrics summary
  calculateMetrics() {
    const now = Date.now();
    const sessionDuration = (now - this.metrics.startTime) / 1000; // in seconds
    
    // Detection latency stats
    const latencies = this.metrics.detectionLatencies.map(d => d.latency);
    const medianLatency = this.calculatePercentile(latencies, 50);
    const p95Latency = this.calculatePercentile(latencies, 95);
    
    // Frame processing stats
    const processingTimes = this.metrics.frameProcessingTimes.map(f => f.processingTime);
    const avgProcessingTime = this.calculateAverage(processingTimes);
    
    // FPS calculation (frames processed per second)
    const recentFrames = this.metrics.frameProcessingTimes.filter(
      f => (now - f.timestamp) < 5000 // Last 5 seconds
    );
    const currentFPS = recentFrames.length / 5;
    
    // Bitrate calculations (convert to kbps)
    const uploadKbps = this.calculateBitrate(this.metrics.webrtcStats.bitrateUpload);
    const downloadKbps = this.calculateBitrate(this.metrics.webrtcStats.bitrateDownload);
    
    // Memory usage
    const memoryUsage = this.getLatestMemoryUsage();
    
    return {
      sessionDuration: Math.round(sessionDuration),
      detection: {
        totalFrames: this.metrics.detectionStats.totalFramesProcessed,
        medianLatency: Math.round(medianLatency || 0),
        p95Latency: Math.round(p95Latency || 0),
        averageProcessingTime: Math.round(avgProcessingTime || 0),
        currentFPS: Math.round(currentFPS * 10) / 10,
        detectionsPerSecond: Math.round(this.metrics.detectionStats.detectionsPerSecond * 10) / 10,
        averageObjectsDetected: Math.round(this.metrics.detectionStats.averageObjectsDetected * 10) / 10
      },
      network: {
        uploadKbps: Math.round(uploadKbps || 0),
        downloadKbps: Math.round(downloadKbps || 0),
        packetsLost: this.metrics.webrtcStats.packetsLost,
        averageJitter: Math.round(this.calculateAverage(this.metrics.webrtcStats.jitter.map(j => j.jitter)) || 0)
      },
      system: {
        memoryUsedMB: Math.round((memoryUsage?.used || 0) / (1024 * 1024)),
        memoryTotalMB: Math.round((memoryUsage?.total || 0) / (1024 * 1024))
      },
      timestamp: new Date().toISOString()
    };
  }

  // Save metrics to file (via server endpoint)
  async saveMetrics() {
    try {
      const metricsData = this.calculateMetrics();
      
      // Save to server
      const response = await fetch('/api/save-metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metricsData)
      });
      
      if (response.ok) {
        console.log('📊 Metrics saved successfully');
        console.log('Current metrics:', metricsData);
      } else {
        throw new Error('Failed to save metrics');
      }
      
      this.metrics.lastSaveTime = Date.now();
      
    } catch (error) {
      console.error('❌ Error saving metrics:', error);
      
      // Fallback: save to localStorage
      this.saveToLocalStorage();
    }
  }

  // Fallback: save to localStorage
  saveToLocalStorage() {
    try {
      const metricsData = this.calculateMetrics();
      const allMetrics = JSON.parse(localStorage.getItem('webrtc_metrics') || '[]');
      allMetrics.push(metricsData);
      
      // Keep only last 50 entries
      if (allMetrics.length > 50) {
        allMetrics.splice(0, allMetrics.length - 50);
      }
      
      localStorage.setItem('webrtc_metrics', JSON.stringify(allMetrics));
      console.log('📊 Metrics saved to localStorage');
      
      // Also save latest to a simple format for easy access
      localStorage.setItem('latest_metrics', JSON.stringify(metricsData));
      
    } catch (error) {
      console.error('❌ Error saving to localStorage:', error);
    }
  }

  // Helper methods
  trimArray(array) {
    if (array.length > this.maxDataPoints) {
      array.splice(0, array.length - this.maxDataPoints);
    }
  }

  calculatePercentile(array, percentile) {
    if (array.length === 0) return 0;
    
    const sorted = [...array].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  calculateAverage(array) {
    if (array.length === 0) return 0;
    return array.reduce((sum, val) => sum + val, 0) / array.length;
  }

  calculateBitrate(dataPoints) {
    if (dataPoints.length < 2) return 0;
    
    const recent = dataPoints.slice(-10); // Last 10 data points
    if (recent.length < 2) return 0;
    
    const timeDiff = (recent[recent.length - 1].timestamp - recent[0].timestamp) / 1000; // seconds
    const bytesDiff = recent[recent.length - 1].bytes - recent[0].bytes;
    
    return (bytesDiff * 8) / (timeDiff * 1000); // Convert to kbps
  }

  updateDetectionRate() {
    const now = Date.now();
    const duration = (now - this.metrics.startTime) / 1000; // seconds
    this.metrics.detectionStats.detectionsPerSecond = 
      this.metrics.detectionStats.totalFramesProcessed / duration;
  }

  updateAverageObjects(objectCount) {
    const total = this.metrics.frameProcessingTimes.reduce((sum, frame) => sum + frame.objectCount, 0);
    this.metrics.detectionStats.averageObjectsDetected = 
      total / this.metrics.frameProcessingTimes.length;
  }

  getLatestMemoryUsage() {
    const memoryData = this.metrics.systemStats.memoryUsage;
    return memoryData.length > 0 ? memoryData[memoryData.length - 1] : null;
  }

  setupAutoSave() {
    setInterval(() => {
      if (this.isMonitoring) {
        this.saveMetrics();
      }
    }, this.saveInterval);
  }

  startSystemMonitoring() {
    // Record system stats every 2 seconds
    const systemMonitor = setInterval(() => {
      if (!this.isMonitoring) {
        clearInterval(systemMonitor);
        return;
      }
      this.recordSystemStats();
    }, 2000);
  }

  setupPerformanceObserver() {
    // Monitor performance entries if available
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          if (!this.isMonitoring) return;
          
          const entries = list.getEntries();
          entries.forEach(entry => {
            if (entry.entryType === 'measure' && entry.name.includes('detection')) {
              this.recordDetectionLatency(entry.startTime, entry.startTime + entry.duration);
            }
          });
        });
        
        observer.observe({ entryTypes: ['measure'] });
      } catch (error) {
        console.warn('PerformanceObserver not supported:', error);
      }
    }
  }

  // Export metrics to JSON string (for download)
  exportMetrics() {
    return JSON.stringify(this.calculateMetrics(), null, 2);
  }

  // Get real-time metrics for display
  getRealTimeMetrics() {
    return this.calculateMetrics();
  }
}

// Create global instance
window.performanceMonitor = new PerformanceMonitor();

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PerformanceMonitor;
}