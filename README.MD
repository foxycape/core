Run in the project root:

```
npm install
```

`pdfjs-dist` is a local `file:` dependency. The project `.npmrc` sets `install-links=true`, so a normal `npm install` installs it correctly (packed into `node_modules`, not as a symlink).

Sometimes installing new npm packages in this project can break pdfjs. If that happens, re-run:

```
npm run fix:pdfjs
```
