// React 19 dropped the global `JSX` namespace; types now live under
// `React.JSX`. Atlas's MDX-author + component code references the
// global namespace in 27 places (return types of function
// components, MDX-component generics). Re-export it globally here
// so React 19 + the existing call sites coexist.
//
// This file is part of the Phase 25 token-migration PR; remove it
// only if the project migrates every `JSX.Element` annotation to
// `React.JSX.Element`.

import type { JSX as ReactJSX } from "react";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    type Element = ReactJSX.Element;
    type ElementClass = ReactJSX.ElementClass;
    type ElementAttributesProperty = ReactJSX.ElementAttributesProperty;
    type ElementChildrenAttribute = ReactJSX.ElementChildrenAttribute;
    type LibraryManagedAttributes<C, P> = ReactJSX.LibraryManagedAttributes<C, P>;
    type IntrinsicAttributes = ReactJSX.IntrinsicAttributes;
    type IntrinsicClassAttributes<T> = ReactJSX.IntrinsicClassAttributes<T>;
    type IntrinsicElements = ReactJSX.IntrinsicElements;
  }
}

export {};
