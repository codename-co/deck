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
    banner:
      label: { en: Banner, fr: Bandeau }
      slots: [default]
      areas: . . . | . default . | . . .
      columns: 1fr 12fr 1fr
      rows: 1fr 6fr 2fr
      art: [band]
    big-question:
      label: { en: Big question, fr: Grande question }
      paper: soft
      justify: center
      title: huge
      pptx: Section Header
      numbered: false
  pictures:
    band: 'data:image/svg+xml,%3Csvg%20xmlns=%22http%3A//www.w3.org/2000/svg%22%20width=%22960%22%20height=%22540%22%20viewBox=%220%200%20960%20540%22%20preserveAspectRatio=%22none%22%3E%3Crect%20width=%22960%22%20height=%2218%22%20fill=%22%23c2410c%22/%3E%3Cpath%20d=%22M0%20540V470Q240%20420%20480%20470T960%20450V540Z%22%20fill=%22%23f3e9dc%22/%3E%3Ccircle%20cx=%2260%22%20cy=%22490%22%20r=%2224%22%20fill=%22%23c2410c%22/%3E%3C/svg%3E'
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
layout: banner
---

## Art behind the words

A band and a wave, as a template draws them, on PowerPoint's layout too.

---
layout: big-question
---

# Do we order in January?

---
layout: grid-of-nine
---

## A layout this deck doesn't have

It falls back to what its content suits.
