---
title: Tricky <script> & R&D
---

# Escapes: R&D, &copy; stays, AT&T

A literal `</script>` in code, and `<script src="x.js">` too.

<!-- a note that mentions <script> and never closes it in code -->

---

## Code

```html
<script>alert("not run")</script>
<!-- <script> -->
```

Backslashes: `<\script` and `<\\/script` stay as written.
