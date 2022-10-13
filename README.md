# React TS CSS

VS Code extenstion that enables CSS modules support for your React projects written in typescript.
Currently supports CSS and SCSS modules with the following capabilities

- [Definitions](https://code.visualstudio.com/api/references/vscode-api#DefinitionProvider)

  - Root selectors
  - Nested Selectors
  - Suffixed Selectors([scss only](https://sass-lang.com/documentation/style-rules/parent-selector#adding-suffixes))

  - <img src='./assets/definitions.gif' height="300"  alt="hover" />

- [Hover](https://code.visualstudio.com/api/references/vscode-api#HoverProvider)

  - Peek properties on hover

  - <img src='./assets/hover.gif' height="300"  alt="hover" />

- [Completions](https://code.visualstudio.com/api/references/vscode-api#HoverProvider)

  - Completion of all types of selectors

  - <img src='./assets/autocomplete.gif' height="300"  alt="hover" />

## Settings

Defaults

```json
{
  "reactTsCSS.peek": true,
  "reactTsCSS.autoComplete": true,
  "reactTsCSS.definition": true
}
```

## Current Feasibilities

1. This extension assumes your project uses CSS/SCSS modules in typescript.
2. The extension currently supports String literals as selector identifiers.This enables usage of camel case and kebab case . Currently the completions are resolved as string literals. This is due to the fact that its a good practice to write class names in kebab case
3. In order for the features to work smoothly, the selectors must have a reference to a CSS module.
4. The extension Supports features for
   - Nested selectors
   - Sibling selectors
   - [Suffix Selectors](https://sass-lang.com/documentation/style-rules/parent-selector#adding-suffixes)
5. CSS module support is also included in the alpha version
6. Cyclic dependencies are also resolved
7. Currently

## RoadMap

1. Plain selectors without any reference is a `no op` in the current version and is expected to be added in coming versions
2. Support camel case property values
3. Support for less and stylus will be added in the future versions
4. [Reference provider](https://code.visualstudio.com/api/references/vscode-api#ReferenceProvider) - Find all references of a selector from inside a css module
5. [Rename Provider](https://code.visualstudio.com/api/references/vscode-api#RenameProvider) - Rename a selector and get all the places updated
