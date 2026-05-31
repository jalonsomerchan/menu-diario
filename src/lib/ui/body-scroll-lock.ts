type BodyScrollLockSnapshot = {
  paddingRight: string;
  position: string;
  scrollBehavior: string;
  top: string;
  width: string;
};

const lockState: {
  count: number;
  scrollY: number;
  snapshot: BodyScrollLockSnapshot | null;
} = {
  count: 0,
  scrollY: 0,
  snapshot: null,
};

function getScrollY() {
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
}

export function lockBodyScroll() {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return () => {};
  }

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    unlockBodyScroll();
  };

  lockState.count += 1;

  if (lockState.count > 1) {
    return release;
  }

  const { body, documentElement } = document;
  const scrollbarWidth = Math.max(0, window.innerWidth - documentElement.clientWidth);
  const currentPaddingRight = window.getComputedStyle(body).paddingRight;

  lockState.scrollY = getScrollY();
  lockState.snapshot = {
    paddingRight: body.style.paddingRight,
    position: body.style.position,
    scrollBehavior: documentElement.style.scrollBehavior,
    top: body.style.top,
    width: body.style.width,
  };

  documentElement.style.scrollBehavior = 'auto';
  body.style.position = 'fixed';
  body.style.top = `-${lockState.scrollY}px`;
  body.style.width = '100%';

  if (scrollbarWidth > 0) {
    body.style.paddingRight = `calc(${currentPaddingRight} + ${scrollbarWidth}px)`;
  }

  return release;
}

export function unlockBodyScroll() {
  if (typeof document === 'undefined' || typeof window === 'undefined' || lockState.count === 0) {
    return;
  }

  lockState.count -= 1;

  if (lockState.count > 0 || !lockState.snapshot) {
    return;
  }

  const { body, documentElement } = document;
  const { paddingRight, position, scrollBehavior, top, width } = lockState.snapshot;
  const scrollY = lockState.scrollY;

  body.style.paddingRight = paddingRight;
  body.style.position = position;
  body.style.top = top;
  body.style.width = width;
  documentElement.style.scrollBehavior = scrollBehavior;
  window.scrollTo(window.scrollX, scrollY);

  lockState.snapshot = null;
  lockState.scrollY = 0;
}
