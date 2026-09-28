import React from 'react';
import { Tooltip } from './Tooltip';
import { motion, Variants } from 'framer-motion';

interface HeatmapDataPoint {
  date: string;
  count: number;
}

interface ActivityHeatmapProps {
  data?: HeatmapDataPoint[];
  days?: number;
  themeColor?: [number, number, number]; // RGB tuple for the base theme color
}

// Helper to generate mock data if none provided
const generateMockData = (days: number): HeatmapDataPoint[] => {
  const result: HeatmapDataPoint[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    result.push({
      date: d.toISOString().split('T')[0],
      count: Math.floor(Math.random() * 15000), // Random traffic up to 15k
    });
  }
  return result;
};

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
  data,
  days = 30,
  themeColor = [167, 139, 250] // Default Klyra purple (rgb(167,139,250))
}) => {
  const heatmapData = data || generateMockData(days);
  const maxCount = Math.max(...heatmapData.map(d => d.count), 1); // Avoid division by zero

  const container: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.02
      }
    }
  };

  const item: Variants = {
    hidden: { scale: 0, opacity: 0 },
    show: { scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 20 } }
  };

  return (
    <div className="activity-heatmap">
      <motion.div 
        className="heatmap-grid"
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-20px" }}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          maxWidth: '300px' // Adjust based on container
        }}
      >
        {heatmapData.map((day, idx) => {
          const intensity = day.count / maxCount;
          // Calculate color based on intensity (0.1 to 1 opacity)
          const opacity = Math.max(0.15, intensity); // minimum opacity so empty days are visible
          const backgroundColor = `rgba(${themeColor[0]}, ${themeColor[1]}, ${themeColor[2]}, ${opacity})`;
          
          return (
            <Tooltip 
              key={day.date} 
              direction="top"
              content={
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                    {Intl.NumberFormat('en-US').format(day.count)}
                  </div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>
                    requests on {day.date}
                  </div>
                </div>
              }
            >
              <motion.div
                variants={item}
                className="heatmap-cell"
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '3px',
                  backgroundColor,
                  cursor: 'crosshair',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}
                whileHover={{ scale: 1.2, borderColor: 'rgba(255,255,255,0.5)', zIndex: 10 }}
              />
            </Tooltip>
          );
        })}
      </motion.div>
    </div>
  );
};
