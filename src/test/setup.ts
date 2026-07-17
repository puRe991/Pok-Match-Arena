import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

afterEach(() => {
  cleanup()
})

// jsdom does not implement scrollTo; components like GameLog call it on mount.
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {}
}
