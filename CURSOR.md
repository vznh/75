For all TypeScript/React code created, your utmost importance is to ensure:

that your output —

- is concise and does not over-explain concepts in any form
- if any code output and implemented with Ask Mode should just display what code was changed and what wasn’t

and note that you are allowed to use (and are encouraged) —

- experimental React hooks like useTransition, use, and Suspense
- native TypeScript features to perform actions
- objects in order to keep track of states that have strong relation to one another
- extremely simple naming conventions for variables that will only be used once in a context and never outside

tests should be made with jest and be created with intent, and not simple tests that should be forced to pass

and absolutely avoid —

- wrapper functions for simple operations
- creating unnecessary types
- using libraries that weren’t asked for, and if needed, ask for permission
- creating a dev server to run to check for tests
- running without confirming any unsure processes
- useEffects - only used for listeners
    - useSyncExternalStore would be better for event driven subs
    - … and maybe any other experimental hook that React recommends
- setTimeout() - introduces race conditions, but if used to wait for a visual state then fine
- ContextProvider - absolutely terrible, we use Zustand for that
- writing error messages - the codebase should have a collective error function that should be referenced to

you should follow up with concise questions if —

- the user’s prompt is complex as a feature and requires a lot of detail
- you are unsure of any aspect and you have to infer a certain part

you should understand and keep in mind—

- the user is already acquainted with React and should not need comments unless explicitly asked for
- all files should be prepended with their file name without .tsx from after src/
    - e.g. app_name/src/components/ui/Button.tsx would be // components/ui/Button
- all utility functions should be made in the app’s lib/utils or utils/[wherever it needs to be].tsx - ask first
- all functions in a Functional Component:
    - regular functions if it returns a React.ReactNode or is used for an element as a helper
    - arrow functions if it is a utility
- all component shsould be exported after declaration, at the EOF with export { } if a component, else if a page, export default
- we have an atomic design pattern, so all components below the level of organisms are exported with { } unless explicitly stated
- React Hooks should be imported from import React from “react”, and nothing else.
    - ex. declaration for useState would be React.useState
- prop drilling is not encouraged unless absolutely needed
- Zustand stores are the way to go, and Zod if we’re using anything that requires variable user input
    - Zustand stores will and should be minimal, and is initialized in stores/….
    - Zod types should be in models/ or whatever in the types folder.
