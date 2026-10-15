import { useRef, useState } from 'react';

const TRIGGER_PX = 80; // how far to swipe before letting go triggers the action
const MAX_PX = 120;
// A swipe starts moving right away; a finger that rests first is a long-press
// (e.g. dnd-kit's drag on task cards) and is left alone.
const DECIDE_WITHIN_MS = 200;

// Swipe a row sideways on a touch screen to run an action: `right` = swipe to
// the right (e.g. done), `left` = swipe to the left (e.g. delete). Each is
// { label, icon, className (background + text color of the revealed strip), onAction }.
// Touch only -- mouse users keep the visible buttons. Vertical scrolling stays
// native (touch-action: pan-y); a gesture counts as a swipe only once it's
// clearly horizontal.
export default function SwipeActions({
  right, left, children, className = '', contentClassName = '', contentStyle,
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef(null);
  const direction = useRef(null); // null | 'h' | 'v'
  const swiped = useRef(false);

  const onTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
    direction.current = null;
    swiped.current = false;
  };

  const onTouchMove = (e) => {
    if (!start.current) return;
    const moveX = e.touches[0].clientX - start.current.x;
    const moveY = e.touches[0].clientY - start.current.y;
    if (direction.current === null) {
      if (Date.now() - start.current.time > DECIDE_WITHIN_MS) direction.current = 'v';
      else if (Math.abs(moveX) > 10 && Math.abs(moveX) > Math.abs(moveY) * 1.5) direction.current = 'h';
      else if (Math.abs(moveY) > 10) direction.current = 'v';
    }
    if (direction.current !== 'h') return;
    // Only follow the finger towards a side that has an action.
    const allowed = (moveX > 0 && right) || (moveX < 0 && left) ? moveX : 0;
    setDragging(true);
    setDx(Math.max(-MAX_PX, Math.min(MAX_PX, allowed)));
  };

  const onTouchEnd = () => {
    if (direction.current === 'h') {
      swiped.current = true;
      const action = dx >= TRIGGER_PX ? right : dx <= -TRIGGER_PX ? left : null;
      if (action) {
        navigator.vibrate?.(10);
        action.onAction();
      }
    }
    start.current = null;
    direction.current = null;
    setDragging(false);
    setDx(0);
  };

  // A finished swipe must not also count as a tap on whatever is under the finger.
  const onClickCapture = (e) => {
    if (swiped.current) {
      e.preventDefault();
      e.stopPropagation();
      swiped.current = false;
    }
  };

  const active = dx > 0 ? right : dx < 0 ? left : null;
  const armed = Math.abs(dx) >= TRIGGER_PX;

  return (
    // Clip only mid-swipe: at rest a child may overflow (e.g. a card being dragged with dnd-kit).
    <div className={`relative ${dx ? 'overflow-hidden' : ''} ${className}`} style={{ touchAction: 'pan-y' }}>
      {active && (
        <div
          aria-hidden="true"
          className={`absolute inset-0 flex items-center px-5 gap-2 text-sm font-semibold ${dx > 0 ? 'justify-start' : 'justify-end'} ${active.className}`}
        >
          <span className={`text-xl transition-transform ${armed ? 'scale-125' : ''}`}>{active.icon}</span>
          <span>{active.label}</span>
        </div>
      )}
      <div
        className={`relative ${dragging ? '' : 'transition-transform duration-200'} ${contentClassName}`}
        style={{ ...contentStyle, transform: dx ? `translateX(${dx}px)` : undefined }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onClickCapture={onClickCapture}
      >
        {children}
      </div>
    </div>
  );
}
