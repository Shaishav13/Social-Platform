import React from 'react';

interface SkeletonLoaderProps {
  count?: number;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ count = 3 }) => {
  return (
    <div className="wren-skeletons" aria-busy="true" aria-label="Loading posts...">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="wren-skeleton">
          {/* Author line skeleton */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              className="wren-skeleton-line"
              style={{ width: '32px', height: '32px', borderRadius: '50%' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div className="wren-skeleton-line" style={{ width: '110px', height: '14px' }} />
              <div className="wren-skeleton-line" style={{ width: '70px', height: '11px' }} />
            </div>
          </div>

          {/* Real serif measure lines: 100%, 92%, 40% */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
            <div className="wren-skeleton-line w-full" />
            <div className="wren-skeleton-line w-92" />
            <div className="wren-skeleton-line w-40" />
          </div>

          {/* Action bar skeleton */}
          <div style={{ display: 'flex', gap: '24px', marginTop: '12px' }}>
            <div className="wren-skeleton-line" style={{ width: '40px', height: '18px' }} />
            <div className="wren-skeleton-line" style={{ width: '40px', height: '18px' }} />
            <div className="wren-skeleton-line" style={{ width: '40px', height: '18px' }} />
          </div>
        </div>
      ))}
    </div>
  );
};
