---
layout: page
permalink: /publications/
title: Publications
description:
nav: true
nav_order: 2
---
<!-- _pages/publications.md -->
<div class="publications" style="margin-top: 0;">

<h3 class="pub-subheading">Conference</h3>

<div class="equal-contrib-note" style="margin-top: -1rem;">
  (*: equal contribution)
</div>

{% bibliography -f papers -q @inproceedings %}

<h3 class="pub-subheading">Journal</h3>

{% bibliography -f papers -q @article %}

</div>
