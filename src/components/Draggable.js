import React, { useEffect, useState, useRef } from 'react';
import { VIEWPORT_DRAGGED } from '../framework/constants';
import { operationTypes } from 'container-common/src/helpers/constant';
import { databaseHandler } from 'container-common/src/helpers/common-helper';

const Draggable = ({ children, type, displayHeight, displayWidth }) => {
  const dragRef = useRef(null);
  const resetPositionCallback = useRef(null);
  const dragEndPositionRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({
    x: window.innerWidth,
    y: 30,
  });
  const [screenHeight, setScreenHeight] = useState(window.screen.height);
  const [screenWidth, setScreenWidth] = useState(window.screen.width);
  const [windowInnerHeight, setWindowInnerHeight] = useState(
    window.innerHeight
  );
  const [windowInnerWidth, setWindowInnerWidth] = useState(window.innerWidth);
  const [dragEndPosition, setDragEndPosition] = useState({});

  const areObjectsEqual = (obj1, obj2) =>
  Object.keys(obj1).length === Object.keys(obj2).length &&
  Object.keys(obj1).every(key => obj1[key] === obj2[key]);


  const handleMouseDown = (e) => {
    const cursorType = window.getComputedStyle(e.target).cursor;
    const elementId = e.target.id;

    if (elementId === type + '_handle' || cursorType === 'move') {
      setIsDragging(true);
      
      const initialX = e.pageX - position.x;
      const initialY = e.pageY - position.y;

      const handleMouseMove = (e) => {
        let x = e.pageX - initialX;
        let y = e.pageY - initialY;

        x = window.innerWidth;
        y = Math.max(
          5,
          Math.min(y, window.innerHeight - 5 - parseInt(displayHeight))
        );

        setPosition({ x, y });
        dragEndPositionRef.current = { x, y };
        const isDragObjectsEquals = areObjectsEqual(dragEndPosition, dragEndPositionRef.current)
        if (dragEndPositionRef.current && !isDragObjectsEquals) {
          savePositionToLocalStorage(dragEndPositionRef.current);
          setDragEndPosition(dragEndPositionRef.current);
        }
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        if (dragEndPositionRef.current) {
          savePositionToLocalStorage(dragEndPositionRef.current);
          dragEndPositionRef.current = null; // Reset drag end position after saving
        }
        if (type && /maximized|minimized/i.test(type)) {
          chrome.runtime.sendMessage({
            action: 'sendAuditEvent',
            event: VIEWPORT_DRAGGED,
          });
        }
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      // Remove event listeners when cursor is taken off the draggable component
      dragRef.current.addEventListener('mouseout', (event) => {
        if (event.target !== dragRef.current) {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
        }
      });
    }
  };

  const savePositionToLocalStorage = (position) => {
    const storageKey = `${type}_position`;

    databaseHandler(operationTypes.SET, [storageKey], position);        
  };

  useEffect(() => {
    (async () => {
    const storageKey = `${type}_position`;
    let result = await databaseHandler(operationTypes.GET, [storageKey]);
    result = result && JSON.parse(result);
    if (result) {
          let x = window.innerWidth;
          let y = Math.max(
          5,
          Math.min(
            result.y,
            window.innerHeight - 5 - parseInt(displayHeight)
            )
          );
          setPosition({ x, y });
        }
    })();
  }, [type]); // Initial load

  function resetPosition() {
    if (
      window.screen.height !== screenHeight ||
      window.screen.width !== screenWidth ||
      window.innerHeight !== windowInnerHeight ||
      window.innerWidth !== windowInnerWidth
    ) {
      let x = window.innerWidth;
      let y = Math.max(
        5,
        Math.min(position.y, window.innerHeight - 5 - parseInt(displayHeight))
      );

      setPosition({ x, y });
      setScreenHeight(window.screen.height);
      setScreenWidth(window.screen.width);
      setWindowInnerHeight(window.innerHeight);
      setWindowInnerWidth(window.innerWidth);
    }
  }

  useEffect(() => {
    let x = window.innerWidth;
    let y = Math.max(
      5,
      Math.min(position.y, window.innerHeight - 5 - parseInt(displayHeight))
    );

    setPosition({ x, y });
  }, [displayHeight, displayWidth]);

  useEffect(() => {
    resetPositionCallback.current = resetPosition;
  }, [windowInnerWidth, windowInnerHeight, screenWidth, screenHeight]);

  useEffect(() => {
    function tick() {
      resetPositionCallback.current();
    }
    let intervalId = setInterval(tick, 2000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div
      id={type + '_handle'}
      ref={dragRef}
      onMouseDown={handleMouseDown}
      style={{
        position: 'fixed',
        zIndex: 999999,
        padding: 0,
        margin: 0,
        border: 'none',
        width: displayWidth + 'px',
        left: position.x + 'px',
        top: position.y + 'px',
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
    >
      {children}
    </div>
  );
};

export default Draggable;
