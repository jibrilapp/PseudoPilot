# IDE language service bridge

Thin wrapper around `@pseudopilot/language-service` + `@pseudopilot/compiler-service`.

- Shared incremental compiler (hash / AST / semantic caches)
- Consumed by Monaco providers in `lib/monaco/`
- Does **not** execute or translate

```ts
import {
  getIdeLanguageService,
  getIdeCompilerService,
  IDE_DOCUMENT_URI,
} from '@/lib/languageService';

const ls = getIdeLanguageService();
ls.updateDocument(IDE_DOCUMENT_URI, source, version);
```

See [`docs/ide/MONACO.md`](../../../../docs/ide/MONACO.md).
