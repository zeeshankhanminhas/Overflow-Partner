# Global State Presentation Matrix

This matrix is the operator-facing validation companion to the Business Lifecycle Constitution.

The authoritative database state remains unchanged. These rows define how that state must be explained.

## Acquisition

| Domain condition | Operating state | Waiting on | What happens next | Approval? |
|---|---|---|---|---|
| No Step 2 session | New enquiry | Overflow Partner | Create technical intake | No |
| Step 2 sent, no submission | Technical intake | Client | Await technical intake | No |
| Client submission received, no Partner request | Technical intake received | Overflow Partner | Send Partner Assessment | No |
| Partner request active, no response | Partner Assessment | Execution Partner | Await Partner Assessment | No |
| Partner clarification requested | Clarification needed | Overflow Partner | Resolve clarification | No |
| Partner response received, price missing | Partner response received | Overflow Partner | Complete Partner price | No |
| Partner response + positive price, no decision | Go / No-Go | Overflow Partner | Record Go / No-Go | Yes |
| Go decision recorded | Ready for Case | Overflow Partner | Create Case 360 | No |
| No-Go decision recorded | Closed | — | No further progression | No |

## Case 360

| Domain condition | Operating state | Waiting on | What happens next | Approval? |
|---|---|---|---|---|
| No technical scope | Technical basis | Overflow Partner | Create technical scope | No |
| Scope drafted, evidence incomplete | Technical basis | Overflow Partner | Complete technical evidence | No |
| Scope ready for approval | Technical basis approval | Overflow Partner | Approve technical scope | Yes |
| Inherited Partner evidence missing/corrupt | Lifecycle integrity issue | Overflow Partner | Restore Acquisition evidence | No |
| Partner cost inherited, commercial position absent | Commercial position | Overflow Partner | Set commercial position | No |
| Commercial position ready | Commercial decision | Overflow Partner | Approve commercial position | Yes |
| Quote controlled document working | Client Quote | Overflow Partner | Complete Client Quote | No |
| Quote approved, not issued | Client Quote | Overflow Partner | Send controlled Client Quote | No |
| Quote issued | Awaiting client decision | Client | Await written client decision | No |
| Written acceptance received | Project handoff | Overflow Partner | Create Project 360 | No |
| Project exists | Handed off | — | Open Project 360 | No |

## Project 360

| Domain condition | Operating state | Waiting on | What happens next | Approval? |
|---|---|---|---|---|
| Mobilisation incomplete | Mobilisation | Overflow Partner | Complete mobilisation | No |
| Mobilisation complete | Mobilisation | Overflow Partner | Release to Execution Partner | No |
| Partner access released, no commencement | Ready to release | Execution Partner | Await Partner commencement | No |
| Commencement confirmed | Ready to release | Overflow Partner | Continue to Partner execution | No |
| In progress, no current-cycle delivery | Partner execution | Execution Partner | Await Partner delivery | No |
| In progress, open Partner exception | Partner execution | Overflow Partner | Resolve Partner exception | No |
| Delivery received, Delivery Control open | Partner delivery received | Overflow Partner | Complete Delivery Control | No |
| Delivery received, Delivery Control clear | Partner delivery received | Overflow Partner | Review Partner delivery | No |
| Internal review incomplete | Internal review | Overflow Partner | Complete internal review | No |
| Internal review complete | Internal review | Overflow Partner | Approve for client release | Yes |
| Partner correction, no revised delivery | Partner correction | Execution Partner | Await revised Partner delivery | No |
| Revised delivery received | Partner correction | Overflow Partner | Review revised Partner delivery | No |
| Ready for client issue | Ready to send | Overflow Partner | Send approved delivery to client | No |
| Issued to client | Sent to client | Client | Await client review | No |
| Client review, no outcome | Client review | Client | Record client outcome when received | No |
| Client accepted | Client review | Overflow Partner | Continue to closeout | No |
| Client changes/rejection | Partner correction | Execution Partner | Await corrected delivery | No |
| Completion incomplete | Delivery complete | Overflow Partner | Complete closeout | No |
| Completion ready | Delivery complete | Overflow Partner | Close project | Yes |
| Closed | Closed | — | No further action | No |

## Documents

| Document condition | Operating state | What happens next | Approval? |
|---|---|---|---|
| Draft / working | Working | Continue document | No |
| In review / signed | Approval needed | Review document | Yes |
| Changes requested | Changes needed | Complete requested changes | No |
| Approved / issued / published / archived | Controlled | No approval needed | No |

## Client Quotes

| Quote condition | Operating state | Waiting on | What happens next |
|---|---|---|---|
| Draft | Quote preparation | Overflow Partner | Complete Client Quote |
| Internal review | Quote approval | Overflow Partner | Review Client Quote |
| Issued | Awaiting client | Client | Await client decision |
| Accepted | Accepted | — | Open Project 360 |
| Rejected / declined | Not proceeding | — | Review outcome |
| Expired | Expired | Overflow Partner | Review revision |

## Partner payables

| Payable condition | Operating state | What happens next | Approval? |
|---|---|---|---|
| Received/matched, evidence not confirmed | Evidence needed | Confirm delivery evidence | Blocked approval |
| Received/matched, evidence confirmed | Approval needed | Approve Partner payable | Yes |
| Approved/scheduled, balance outstanding | Partner payable | Record payment | No |
| Paid/settled | Settled | No further action | No |

## Mission Control classification

A record may appear in only the category matching the actual operating need:

- **Approvals**: explicit authority decision is due.
- **Dependencies**: the next move belongs to client, Partner or another normal actor and is not off-plan.
- **Issues**: blocker, exception, overdue condition or other off-plan work requires intervention.

A normal wait must never be counted as an issue solely because the lifecycle cannot advance yet.

## Visual validation

For each matrix state, verify:

1. The operating state is visible before secondary detail.
2. The waiting owner is truthful.
3. The next action exists only when the evidence condition supports it.
4. A passive wait does not display a false action button.
5. Empty evidence does not render `0 of 0` scaffolding.
6. Approval is visible in Approvals and links to the authoritative source.
7. Portfolio/register presentation agrees with the record detail.
8. Desktop and mobile retain the same semantic priority.
