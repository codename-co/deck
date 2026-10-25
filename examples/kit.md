---
title: A second oven, in our own look
lang: en
kit:
  name: Martin's bakery
  tokens:
    paper: '#fbfaf7'
    ink: '#1f2a2e'
    primary: '#c2410c'
    voice: elegant
    radius: 4
    logo: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNjggNDgiPjxyZWN0IHg9IjIiIHk9IjYiIHdpZHRoPSIzNiIgaGVpZ2h0PSIzNiIgcng9IjkiIGZpbGw9IiNjMjQxMGMiLz48cGF0aCBkPSJNMTEgMzBxOS0xNCAxOCAwIiBmaWxsPSJub25lIiBzdHJva2U9IiNmYmZhZjciIHN0cm9rZS13aWR0aD0iMy41IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48dGV4dCB4PSI0OCIgeT0iMzMiIGZvbnQtZmFtaWx5PSJHZW9yZ2lhLCBzZXJpZiIgZm9udC1zaXplPSIyNSIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iIzFmMmEyZSI+TWFydGluPC90ZXh0Pjwvc3ZnPg=='
    logoAt: top-end
    dark:
      logo: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNjggNDgiPjxyZWN0IHg9IjIiIHk9IjYiIHdpZHRoPSIzNiIgaGVpZ2h0PSIzNiIgcng9IjkiIGZpbGw9IiNjMjQxMGMiLz48cGF0aCBkPSJNMTEgMzBxOS0xNCAxOCAwIiBmaWxsPSJub25lIiBzdHJva2U9IiNmYmZhZjciIHN0cm9rZS13aWR0aD0iMy41IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48dGV4dCB4PSI0OCIgeT0iMzMiIGZvbnQtZmFtaWx5PSJHZW9yZ2lhLCBzZXJpZiIgZm9udC1zaXplPSIyNSIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iI2ZiZmFmNyI+TWFydGluPC90ZXh0Pjwvc3ZnPg=='
  layouts:
    three-numbers:
      label: { en: Three numbers, fr: Trois chiffres }
      slots: [default, one, two, three]
      areas: default default default | one two three
      rows: auto 1fr
      align: center
      justify: center
      pptx: Comparison
    big-question:
      label: { en: Big question, fr: Grande question }
      paper: soft
      justify: center
      title: huge
      pptx: Section Header
      numbered: false
---

# A second oven

Plan for 2027 · Martin's bakery

---

# Why now

---
layout: three-numbers
---

## The case in three numbers

::one::

# 40

more croissants a day

::two::

# 14

months to pay it back

::three::

# 1

more baker's shift

---

## Where we are

- Sold out by 10
- Queues on Saturdays

::right::

- One oven
- Full at 6 am

---

# €21,400

All in, with a week closed

---

> The queue is the best advert we have, and the worst welcome.

Léa, on Saturdays

---
layout: big-question
---

# Do we order in January?

---
layout: grid-of-nine
---

## A layout this deck doesn't have

It falls back to what its content suits.
