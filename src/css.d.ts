// The stylesheet, bundled as text by build.mjs.
declare module '*.css' {
  const text: string
  export default text
}
