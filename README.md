## Install

```
$ npm i source-finder
```

## Usage

```
const sourceFinder = require('source-finder');
const root = process.cwd();
const source = 'src';
const sourceLists = sourceFinder.find(root, source, {
  recursive: true
});
const base = sourceFinder.base(source)
```

## API

### find(root, source, options)
Return a arrary of source path.

#### options
Type: `Object`

`recursive:Boolean` | `eliminated:Boolean` | `dotfiles:Boolean`

#### root
Type: `String`

#### source
Type: `String`

## License

MIT