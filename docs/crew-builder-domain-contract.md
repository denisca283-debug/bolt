# Canonical Project Need / Crew Builder contract

## IMPLEMENTED

project_needs is the only stored needs domain. Manual Project page creates the same type the typed project.create_need tool references.
Targets: person, casting_subject, organization, equipment, package, location, transport, service, postproduction, other.
SQL and TypeScript route person → sealed professional proposal; actor/model → casting; child actor → protected guardian casting; camera package → equipment sourcing; post house → company RFP; transport/location/service → provider sourcing.
Database rejects mismatched route/target combinations and cross-type sourcing attachment. Creation/edits require actual project authority, reads require project collaboration. No AI shadow state.
Tests cover manual persistence/reload, failed-save truthfulness, mobile overflow and exclusion of casting/person needs from equipment auction.

## FOUNDATION ONLY

Contract and canonical need creation/list UI; NOT full Crew Builder or automatic matching.
Need creation does not invite, award, book, approve compliance or commit a person.
Student Guided Mode must reuse this engine rather than create parallel educational needs.

## FUTURE DEPENDENCY

Evidence-backed resolution candidates, availability validation, multi-constraint matching, per-role shortlist, explicit budget scenarios, user-approved invites and accessible guided mode.

## RELEASE BLOCKER

No claims of automatic staffed crew, guaranteed availability or perfect-match scores. Professional graph is one evidence factor and must not outrank equally qualified unrelated people or become paid ranking.
