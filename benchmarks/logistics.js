/**
 * Generalization check: a logistics operations product, unrelated to the advisory benchmark. Kestrel Freight, its
 * shipments, carriers, and invoices are fictional. Same two conditions as benchmarks/wealth.js.
 */
const DEMO = { mode: 'demo', label: 'Kestrel Freight is fictional; every shipment and figure is synthetic.' };
const screen = (title, layout, children, plan) => ({ version: 'syntari-ir-1', type: 'screen', title, layout, meta: { data: DEMO, ...(plan ? { plan } : {}) }, children });
const section = (id, heading, children, extra = {}) => ({ id, type: 'section', heading, ...extra, children });
const region = (id, label, children, open = false) => ({ id, type: 'region', label, ...(open ? { open } : {}), children });
const node = (id, component, props) => ({ id, component: `syntari.${component}`, props });
const coordinator = { role: 'Logistics operations coordinator', frequency: 'daily' };

export const logistics = [
  {
    id: 'shipment-record',
    product: 'Kestrel Freight',
    title: 'Delayed shipment',
    request: 'Show shipment SHP-20931 for the operations team.',
    brief: {
      request: 'Show shipment SHP-20931 for the operations team.',
      user: coordinator,
      subject: 'entity',
      job: { primary: 'get a shipment held at customs moving again', mode: 'resolve' },
      decisions: ['Whether to reroute the container through Rotterdam', 'Which documents to chase first'],
      information: [
        { id: 'shipment', label: 'Shipment profile', kind: 'entity-profile', neededFor: ['orient before acting'] },
        { id: 'hold', label: 'Customs hold', kind: 'exception', exception: true },
        { id: 'actions', label: 'Open actions on the shipment', kind: 'pending-item', neededFor: ['which documents to chase'] },
        { id: 'reroute', label: 'What rerouting changes', kind: 'impact', neededFor: ['reroute or wait'] },
        { id: 'route', label: 'Route progress', kind: 'records' },
        { id: 'documents', label: 'Shipping documents', kind: 'records', frequency: 'rare' },
        { id: 'events', label: 'Event log', kind: 'history', frequency: 'rare' }
      ],
      actions: [{ label: 'Reroute through Rotterdam', kind: 'primary', consequential: true }]
    },
    baseline: {
      derivation: 'The policy’s monitoring pattern (“the current state of a live system and what changed recently”: state, recent, history). Measures of the shipment’s state, a banner for the hold, a card per document a person opens, the route, and the decision as an approval card.',
      nodes: { shipment: ['state'], hold: ['hold'], actions: ['doc-invoice'], route: ['route'], documents: ['doc-packing', 'doc-lading'], events: ['events'] },
      spec: screen('Shipment SHP-20931', 'stack', [
        node('state', 'stat-row', { stats: [{ label: 'Promised delivery', value: '14 May', note: 'to Lyon' }, { label: 'Days in transit', value: '23', note: 'of 26 planned' }, { label: 'Customs', value: 'Held', badge: 'Since Tue', tone: 'danger', note: 'Hamburg' }, { label: 'Lines', value: '14', note: 'on the invoice' }] }),
        node('hold', 'banner', { tone: 'info', icon: 'info', message: 'This shipment is held at customs', detail: 'Hamburg customs is reviewing the commercial invoice.' }),
        section('documents', 'Documents', [
          node('doc-invoice', 'card', { title: 'Commercial invoice', body: 'HS codes missing on 2 of 14 lines.', badge: 'Action needed', badgeTone: 'danger', action: 'Open', mark: 'file' }),
          node('doc-packing', 'card', { title: 'Packing list', body: 'Received from the shipper.', badge: 'Received', badgeTone: 'success', action: 'Open', mark: 'file' }),
          node('doc-lading', 'card', { title: 'Bill of lading', body: 'Issued by Rhine Freight.', badge: 'Received', badgeTone: 'success', action: 'Open', mark: 'file' })
        ], { layout: 'grid' }),
        node('route', 'process-ledger', { stages: [{ title: 'Shanghai', detail: 'Departed 18 April', time: 'Done', state: 'done' }, { title: 'Sea leg', detail: 'Arrived Hamburg 7 May', time: '19 d', state: 'done' }, { title: 'Hamburg customs', detail: 'Held since Tuesday', time: '2 d', state: 'current' }, { title: 'Truck to Lyon', detail: 'Booked for 12 May', time: '—', state: 'pending' }] }),
        node('events', 'activity-list', { items: [{ icon: 'clock', title: 'Customs hold', detail: 'Invoice under review', time: 'Tue' }, { icon: 'check', title: 'Arrived Hamburg', detail: 'Berth 4', time: '7 May' }, { icon: 'check', title: 'Departed Shanghai', detail: 'Vessel Kestrel Aurora', time: '18 Apr' }] }),
        node('approve', 'approval-card', { title: 'Reroute through Rotterdam', summary: 'Move the container to Rotterdam for clearance.', detail: 'Suggested by the routing assistant.', approveLabel: 'Approve', rejectLabel: 'Decline' })
      ], { pattern: 'monitoring', purpose: 'The state of the shipment.', rationale: 'State, recent, history.' })
    },
    intent: {
      nodes: { shipment: ['shipment'], hold: ['hold'], actions: ['open-actions'], reroute: ['reroute-impact'], route: ['route'], documents: ['documents-table'], events: ['events'] },
      actionNode: 'reroute',
      spec: screen('SHP-20931 · Shanghai to Lyon', 'split', [
        section('work', 'Held at Hamburg customs', [
          node('hold', 'banner', { tone: 'danger', icon: 'clock', message: 'Customs has held the container since Tuesday', detail: 'The commercial invoice lacks HS codes on 2 of 14 lines. Clearance takes about a day once corrected.' }),
          node('shipment', 'metadata-list', { items: [{ label: 'Customer', value: 'Atelier Rousseau, Lyon' }, { label: 'Promised', value: '14 May' }, { label: 'Carrier', value: 'Rhine Freight' }, { label: 'Container', value: '40 ft, 14 invoice lines' }] }),
          node('open-actions', 'checklist', { title: 'To get it moving', items: [
            { title: 'Send the corrected invoice to the broker', detail: 'HS codes for lines 6 and 11', time: 'Today' },
            { title: 'Tell Atelier Rousseau the new date', detail: 'They asked to be told by 16:00', time: '16:00' },
            { title: 'Rebook the truck to Lyon', detail: 'After clearance', time: 'Later' }
          ] }),
          section('reroute-section', 'If you reroute through Rotterdam', [
            node('reroute-impact', 'value-diff', { caption: 'Rerouting clears faster but costs more', fromLabel: 'Wait in Hamburg', toLabel: 'Reroute', rows: [{ field: 'Delivery in Lyon', from: '16 May', to: '15 May' }, { field: 'Extra cost', from: '€0', to: '€1,240' }, { field: 'Customer promise', from: 'Missed by 2 days', to: 'Missed by 1 day' }] }),
            node('reroute', 'tool-approval', { title: 'Reroute through Rotterdam?', question: 'Move the container by barge to Rotterdam and clear it there.', scope: 'SHP-20931 · Rhine Freight booking · €1,240', approveLabel: 'Reroute', rejectLabel: 'Wait in Hamburg' })
          ]),
          region('documents', 'Shipping documents · 3', [node('documents-table', 'table', { caption: 'Shipping documents', columns: [{ label: 'Document' }, { label: 'Status' }, { label: 'From' }], rows: [['Commercial invoice', 'HS codes missing', 'Shipper'], ['Packing list', 'Received', 'Shipper'], ['Bill of lading', 'Received', 'Rhine Freight']] })]),
          region('events-region', 'Event log', [node('events', 'activity-list', { items: [{ icon: 'clock', title: 'Customs hold', detail: 'Invoice under review', time: 'Tue' }, { icon: 'check', title: 'Arrived Hamburg', detail: 'Berth 4', time: '7 May' }, { icon: 'check', title: 'Departed Shanghai', detail: 'Vessel Kestrel Aurora', time: '18 Apr' }] })])
        ], { emphasis: 'primary' }),
        section('context', 'Route', [
          node('route', 'process-ledger', { stages: [{ title: 'Shanghai', detail: 'Departed 18 April', time: 'Done', state: 'done' }, { title: 'Sea leg', detail: 'Arrived Hamburg 7 May', time: '19 d', state: 'done' }, { title: 'Hamburg customs', detail: 'Held since Tuesday', time: '2 d', state: 'current' }, { title: 'Truck to Lyon', detail: 'Rebook after clearance', time: '—', state: 'pending' }] })
        ])
      ])
    },
    observations: [
      'Baseline: four measures and a calm info banner come before the hold; documents are three equal cards; the reroute is approved without its cost or new date.',
      'Intent-aware: the hold and its cause lead, then what to do, then what rerouting changes beside the decision. The route sits beside it; documents and events wait.'
    ]
  },
  {
    id: 'freight-invoice',
    product: 'Kestrel Freight',
    title: 'Freight invoice audit',
    request: 'Audit the Rhine Freight invoice for April against the rate card.',
    brief: {
      request: 'Audit the Rhine Freight invoice for April against the rate card.',
      user: { role: 'Freight auditor', frequency: 'daily' },
      job: { primary: 'confirm what to pay on the Rhine Freight April invoice', mode: 'review' },
      decisions: ['Which charges to accept as invoiced', 'Whether to approve the adjusted payment'],
      information: [
        { id: 'invoice', label: 'Rhine Freight April invoice', kind: 'source-document', neededFor: ['which charges to accept'] },
        { id: 'disputed', label: 'Charges that differ from the rate card', kind: 'discrepancy', neededFor: ['which charges to accept'] },
        { id: 'payment', label: 'What the payment becomes', kind: 'impact', neededFor: ['approve the adjusted payment'] },
        { id: 'agreed', label: 'Charges that match the rate card', kind: 'extracted-value', frequency: 'rare' }
      ],
      actions: [{ label: 'Approve adjusted payment', kind: 'primary', consequential: true }]
    },
    baseline: {
      derivation: 'The Release review screen and the transaction pattern: an outcome banner, headline measures, the comparison, a text block on what the numbers mean, the approval card, and evidence in regions.',
      nodes: { invoice: ['invoice-meta'], disputed: ['compare'], agreed: ['agreed-list'] },
      spec: screen('Rhine Freight · April invoice', 'stack', [
        node('outcome', 'banner', { tone: 'info', icon: 'info', message: 'Invoice checked against the rate card', detail: 'Some charges differ from the agreed rates.' }),
        node('stats', 'stat-row', { stats: [{ label: 'Charges', value: '14', note: 'on 3 pages' }, { label: 'Agreed', value: '11', note: 'match the rate card' }, { label: 'Disputed', value: '3', badge: 'Review', tone: 'warning', note: 'differ' }, { label: 'Invoiced', value: '€18,420', note: 'due 30 May' }] }),
        node('compare', 'comparison-table', { caption: 'Rate card against the invoice', optionA: 'Rate card', optionB: 'Invoice', rows: [{ metric: 'Fuel surcharge', a: '12.5%', b: '14.0%', advantage: 'Rate card' }, { metric: 'Waiting time', a: '2 hours', b: '5 hours', advantage: 'Rate card' }, { metric: 'Port handling', a: '€380', b: '€420', advantage: 'Rate card' }] }),
        node('summary', 'text-block', { body: 'Some charges on this invoice are higher than the rate card. Approving the adjusted payment will change the amount paid to the carrier.' }),
        node('approve', 'approval-card', { title: 'Adjusted payment', summary: 'Pay Rhine Freight the adjusted amount for April.', detail: '3 charges disputed.', approveLabel: 'Approve', rejectLabel: 'Reject' }),
        region('invoice', 'Invoice', [node('invoice-meta', 'metadata-list', { items: [{ label: 'Carrier', value: 'Rhine Freight' }, { label: 'Number', value: 'RF-2026-0412' }, { label: 'Period', value: 'April 2026' }] })]),
        region('agreed', 'Agreed charges', [node('agreed-list', 'metadata-list', { items: [{ label: 'Linehaul Hamburg–Lyon', value: '€9,860' }, { label: 'Container 40 ft', value: '€1,860' }] })])
      ], { pattern: 'transaction', purpose: 'Approve the April payment.', rationale: 'Outcome, evidence, decision.' })
    },
    intent: {
      nodes: { invoice: ['invoice'], disputed: ['disputed'], payment: ['payment'], agreed: ['agreed-list'] },
      actionNode: 'approve',
      spec: screen('Rhine Freight · April invoice', 'split', [
        section('audit', 'Three charges differ from the rate card', [
          node('disputed', 'value-diff', { caption: 'Invoice RF-2026-0412 against the 2026 rate card', fromLabel: 'Rate card', toLabel: 'Invoiced', choosable: true, useLabel: 'Accept invoiced', keepLabel: 'Pay rate card', rows: [
            { field: 'Fuel surcharge', from: '12.5%', to: '14.0%', note: 'Page 1 · line 9', ref: 'fuel', keep: true },
            { field: 'Waiting time, Lyon', from: '2 hours free', to: '5 hours billed', note: 'Page 2 · line 3', ref: 'wait', status: 'conflict' },
            { field: 'Port handling', from: '€380', to: '€420', note: 'Page 2 · line 7', ref: 'port', keep: true }
          ] }),
          section('payment-section', 'What the payment becomes', [
            node('payment', 'value-diff', { caption: 'Accepting the waiting time; fuel and port at the rate card', fromLabel: 'Invoiced', toLabel: 'To pay', rows: [{ field: 'Fuel surcharge', from: '€1,610', to: '€1,437' }, { field: 'Port handling', from: '€420', to: '€380' }, { field: 'Total', from: '€18,420.00', to: '€18,207.00' }] })
          ]),
          node('approve', 'tool-approval', { title: 'Approve €18,207.00?', question: 'Pay the adjusted amount and send Rhine Freight the two disputed lines.', scope: 'Rhine Freight · invoice RF-2026-0412 · due 30 May', approveLabel: 'Approve payment', rejectLabel: 'Hold invoice' }),
          region('agreed', 'Charges that match · 11', [node('agreed-list', 'metadata-list', { items: [{ label: 'Linehaul Hamburg to Lyon', value: '€9,860' }, { label: 'Container 40 ft', value: '€1,860' }, { label: 'Customs filing', value: '€140' }, { label: 'and 8 more', value: 'Under €500 each' }] })])
        ], { emphasis: 'primary' }),
        section('source', 'Invoice', [
          node('invoice', 'source-excerpt', { title: 'Rhine Freight · invoice RF-2026-0412', meta: 'April 2026 · pages 1 and 2', lines: [
            { label: 'Linehaul Hamburg to Lyon', value: '€9,860.00' }, { label: 'Fuel surcharge 14.0%', value: '€1,610.00', ref: 'fuel', flagged: true },
            { label: 'Waiting time Lyon, 5 h', value: '€375.00', ref: 'wait', flagged: true }, { label: 'Port handling', value: '€420.00', ref: 'port', flagged: true }, { label: 'Total', value: '€18,420.00' }
          ] })
        ])
      ])
    },
    observations: [
      'Baseline: the comparison table can only say which side has the advantage; “some charges” and “change the amount” name nothing; the invoice is its metadata in a region.',
      'Intent-aware: each disputed line against the invoice text, a choice per charge, and the exact payment that results beside the approval.'
    ]
  },
  {
    id: 'carrier-quotes',
    product: 'Kestrel Freight',
    title: 'Carrier comparison',
    request: 'Compare the three carrier quotes for the Lyon lane.',
    brief: {
      request: 'Compare the three carrier quotes for the Lyon lane.',
      user: { role: 'Freight buyer', frequency: 'occasional' },
      job: { primary: 'award the Hamburg to Lyon lane for the next quarter', mode: 'decide' },
      decisions: ['Which carrier to award the lane to'],
      information: [
        { id: 'quotes', label: 'Carrier quotes', kind: 'alternative', neededFor: ['which carrier to award'] },
        { id: 'requirements', label: 'What every quote includes', kind: 'records', frequency: 'rare' }
      ],
      actions: [{ label: 'Award the lane', kind: 'primary', consequential: true }]
    },
    baseline: {
      derivation: 'The policy’s comparison pattern (options, differences, choice): a card per option with its own action, the quotes as records, and an approval card for the award. A bar chart of prices was the first choice; validation refused it (bar values are percentages), so the prices went into a table.',
      nodes: { quotes: ['quote-rhine', 'quote-alpen', 'quote-loire', 'prices'] },
      spec: screen('Hamburg to Lyon · carrier quotes', 'stack', [
        section('options', 'Quotes', [
          node('quote-rhine', 'card', { title: 'Rhine Freight', body: '€2,140 a container, 3 days, 96% on time.', badge: 'Incumbent', badgeTone: 'accent', action: 'Choose', mark: 'file' }),
          node('quote-alpen', 'card', { title: 'Alpen Logistik', body: '€1,980 a container, 4 days, 91% on time.', badge: 'Cheapest', badgeTone: 'success', action: 'Choose', mark: 'file' }),
          node('quote-loire', 'card', { title: 'Loire Transport', body: '€2,060 a container, 3 days, 94% on time.', badge: 'New', badgeTone: 'neutral', action: 'Choose', mark: 'file' })
        ], { layout: 'grid' }),
        node('prices', 'table', { caption: 'Quotes', sortable: true, columns: [{ label: 'Carrier' }, { label: 'Per container' }, { label: 'Transit' }, { label: 'On time' }], rows: [['Rhine Freight', '€2,140', '3 days', '96%'], ['Alpen Logistik', '€1,980', '4 days', '91%'], ['Loire Transport', '€2,060', '3 days', '94%']] }),
        node('award', 'approval-card', { title: 'Award the lane', summary: 'Award Hamburg to Lyon for the third quarter.', detail: 'About 120 containers.', approveLabel: 'Award', rejectLabel: 'Not yet' })
      ], { pattern: 'comparison', purpose: 'Choose a carrier.', rationale: 'Options, differences, choice.' })
    },
    intent: {
      nodes: { quotes: ['quote-table'], requirements: ['requirements-list'] },
      spec: screen('Hamburg to Lyon · award the lane', 'stack', [
        section('differ', 'How the quotes differ', [
          node('quote-table', 'table', { caption: 'Quotes for about 120 containers in the third quarter', columns: [{ label: 'Carrier' }, { label: 'Per container' }, { label: 'Transit' }, { label: 'On time, 90 days' }, { label: 'Quarter cost' }], rows: [['Alpen Logistik', '€1,980', '4 days', '91%', '€237,600'], ['Loire Transport', '€2,060', '3 days', '94%', '€247,200'], ['Rhine Freight', '€2,140', '3 days', '96%', '€256,800']] })
        ], { emphasis: 'primary' }),
        section('choice', 'Award the lane', [
          node('carrier', 'radio', { label: 'Carrier for the third quarter', name: 'carrier', options: [{ label: 'Alpen Logistik, cheapest, one day slower', value: 'alpen' }, { label: 'Loire Transport, €9,600 more, three days', value: 'loire' }, { label: 'Rhine Freight, €19,200 more, most reliable', value: 'rhine' }], hint: 'Atelier Rousseau’s contract promises delivery within 4 days.' })
        ], { submit: 'Award the lane', consequential: true }),
        region('shared', 'What every quote includes', [node('requirements-list', 'metadata-list', { items: [{ label: 'Insurance', value: 'Cargo to €150,000' }, { label: 'Tracking', value: 'Hourly position' }, { label: 'Payment', value: '30 days' }] })])
      ])
    },
    observations: [
      'Baseline: each option in its own card with its own Choose button and the award again in an approval card; prices are drawn, but transit and reliability are buried in sentences.',
      'Intent-aware: one table on shared columns, then one choice that names each tradeoff, as a form that asks the host to confirm.'
    ]
  }
];
