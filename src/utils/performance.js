// Performance monitoring and optimization utilities
import React from 'react';

class PerformanceMonitor {
  constructor() {
    this.marks = new Map();
    this.measures = [];
    this.memoryWarnings = 0;
    this.renderTimes = [];
  }

  // Mark start of performance measurement
  mark(label) {
    this.marks.set(label, Date.now());
    if (__DEV__) {
      console.log(`[Perf] Mark: ${label}`);
    }
  }

  // Measure time between marks
  measure(label, startMark, endMark = null) {
    const endTime = endMark ? this.marks.get(endMark) : Date.now();
    const startTime = this.marks.get(startMark);
    
    if (!startTime) {
      console.warn(`[Perf] Start mark "${startMark}" not found`);
      return null;
    }

    const duration = endTime - startTime;
    const measurement = { label, startMark, duration, timestamp: Date.now() };
    this.measures.push(measurement);

    if (__DEV__) {
      console.log(`[Perf] ${label}: ${duration}ms`);
      
      // Warn about slow operations
      if (duration > 1000) {
        console.warn(`[Perf] Slow operation detected: ${label} took ${duration}ms`);
      }
    }

    return measurement;
  }

  // Track component render times
  trackRender(componentName, renderTime) {
    const measurement = {
      component: componentName,
      renderTime,
      timestamp: Date.now()
    };
    
    this.renderTimes.push(measurement);
    
    // Keep only last 100 measurements
    if (this.renderTimes.length > 100) {
      this.renderTimes.shift();
    }

    if (__DEV__ && renderTime > 16) {
      console.warn(`[Perf] Slow render: ${componentName} took ${renderTime}ms`);
    }
  }

  // Get performance summary
  getSummary() {
    const recentMeasures = this.measures.slice(-20);
    const avgRenderTime = this.renderTimes.length > 0 
      ? this.renderTimes.reduce((sum, m) => sum + m.renderTime, 0) / this.renderTimes.length
      : 0;

    return {
      totalMeasurements: this.measures.length,
      recentMeasures,
      averageRenderTime: Math.round(avgRenderTime * 100) / 100,
      memoryWarnings: this.memoryWarnings,
      slowOperations: this.measures.filter(m => m.duration > 1000).length
    };
  }

  // Memory warning handler
  onMemoryWarning() {
    this.memoryWarnings++;
    if (__DEV__) {
      console.warn(`[Perf] Memory warning #${this.memoryWarnings}`);
    }
  }

  // Clear old measurements
  cleanup() {
    // Keep only last 50 measurements
    if (this.measures.length > 50) {
      this.measures = this.measures.slice(-50);
    }
    
    // Clear old marks
    const cutoff = Date.now() - 60000; // 1 minute ago
    for (const [key, time] of this.marks.entries()) {
      if (time < cutoff) {
        this.marks.delete(key);
      }
    }
  }
}

// Global performance monitor instance
export const perfMonitor = new PerformanceMonitor();

// Higher-order component for performance tracking
export function withPerformanceTracking(WrappedComponent, componentName) {
  return function PerformanceTrackedComponent(props) {
    const renderStart = Date.now();
    
    React.useEffect(() => {
      const renderTime = Date.now() - renderStart;
      perfMonitor.trackRender(componentName || WrappedComponent.name, renderTime);
    });

    return React.createElement(WrappedComponent, props);
  };
}

// Hook for component-level performance tracking
export function usePerformanceTracking(componentName) {
  const startTime = React.useRef(Date.now());
  
  React.useEffect(() => {
    const renderTime = Date.now() - startTime.current;
    perfMonitor.trackRender(componentName, renderTime);
  });

  const trackOperation = React.useCallback((operationName, operation) => {
    return async (...args) => {
      perfMonitor.mark(`${componentName}-${operationName}-start`);
      try {
        const result = await operation(...args);
        perfMonitor.measure(
          `${componentName}-${operationName}`,
          `${componentName}-${operationName}-start`
        );
        return result;
      } catch (error) {
        perfMonitor.measure(
          `${componentName}-${operationName}-error`,
          `${componentName}-${operationName}-start`
        );
        throw error;
      }
    };
  }, [componentName]);

  return { trackOperation };
}

// Bundle size analyzer helper
export const BundleAnalyzer = {
  // Estimate component bundle impact
  estimateComponentSize(componentName) {
    if (__DEV__) {
      console.log(`[Bundle] Analyzing ${componentName}`);
      // In development, we can't get actual sizes, but we can log for analysis
      return { estimated: true, component: componentName };
    }
    return null;
  },

  // Track dynamic imports
  trackDynamicImport(moduleName) {
    if (__DEV__) {
      console.log(`[Bundle] Dynamic import: ${moduleName}`);
    }
  }
};

// Memory leak detection helpers
export const MemoryTracker = {
  // Track component mount/unmount for leak detection
  trackComponent(componentName) {
    if (__DEV__) {
      const mounted = new Set();
      
      return {
        onMount: (id = 'default') => {
          mounted.add(id);
          console.log(`[Memory] ${componentName} mounted (${mounted.size} instances)`);
        },
        
        onUnmount: (id = 'default') => {
          mounted.delete(id);
          console.log(`[Memory] ${componentName} unmounted (${mounted.size} instances)`);
          
          if (mounted.size > 10) {
            console.warn(`[Memory] Potential leak: ${componentName} has ${mounted.size} instances`);
          }
        }
      };
    }
    
    return { onMount: () => {}, onUnmount: () => {} };
  },

  // Track large data structures
  trackDataSize(dataName, data) {
    if (__DEV__ && data) {
      const size = JSON.stringify(data).length;
      console.log(`[Memory] ${dataName}: ~${(size / 1024).toFixed(1)}KB`);
      
      if (size > 100000) { // > 100KB
        console.warn(`[Memory] Large data structure: ${dataName} is ~${(size / 1024).toFixed(1)}KB`);
      }
    }
  }
};

// Performance optimization suggestions
export const OptimizationSuggestions = {
  // Suggest optimizations based on performance data
  analyze() {
    const summary = perfMonitor.getSummary();
    const suggestions = [];

    if (summary.averageRenderTime > 16) {
      suggestions.push({
        type: 'render',
        severity: 'warning',
        message: `Average render time is ${summary.averageRenderTime}ms. Consider using React.memo or useMemo for expensive components.`
      });
    }

    if (summary.slowOperations > 5) {
      suggestions.push({
        type: 'async',
        severity: 'error',
        message: `${summary.slowOperations} slow operations detected. Consider adding loading states and optimizing async operations.`
      });
    }

    if (summary.memoryWarnings > 0) {
      suggestions.push({
        type: 'memory',
        severity: 'error',
        message: `${summary.memoryWarnings} memory warnings. Check for memory leaks and large data structures.`
      });
    }

    return suggestions;
  }
};

export default perfMonitor;