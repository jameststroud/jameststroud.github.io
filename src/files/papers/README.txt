PDFs of published papers.

Drop PDF files in this folder and a "PDF" link appears next to the matching
paper on the Publications page. You do not need to rename them or edit
anything else.

The matcher looks for an author surname and a year in the filename, then
scores title words. Names like these all work:

    Stroud et al 2023 PNAS.pdf
    stroud_2023_fluctuating_selection.pdf
    Stroud-Losos-2016-Ecological-Opportunity.pdf
    Miller & Stroud 2022 - key innovations.pdf

Anything it cannot place with confidence is left unlinked rather than guessed
at, and the build log lists it. If a file will not match, add a line to that
paper's entry in src/_data/publications.yaml:

    pdf: "the-exact-filename.pdf"

A note on which PDFs to post. Most publishers allow you to host the accepted
manuscript (the post-review, pre-typesetting version) on your own site, but
not the final typeset version. Open access papers can be posted as published.
Check a journal on sherpa.ac.uk/romeo if you are unsure.
