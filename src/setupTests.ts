import '@testing-library/jest-dom/vitest'

// jsdom doesn't implement scrolling; components that call it (e.g. GameLog's
// auto-scroll-to-bottom) would otherwise throw in tests.
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {}
}
