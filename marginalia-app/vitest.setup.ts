import '@testing-library/jest-dom'
import 'jest-axe/extend-expect'

// jsdom doesn't implement matchMedia — provide a stub that defaults to light mode.
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: (query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: () => {},
		removeListener: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false,
	}),
});

// jsdom doesn't implement ResizeObserver — provide a no-op stub.
global.ResizeObserver = class ResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
};
