# Product Journey

## Scenario

A food-processing plant orders four replacement bearings from an industrial distributor because a conveyor must remain operational.

| Stage               | Actor                  | Physical reality                          | Authoritative system    | Business fact                      | Possible impact                            |
| ------------------- | ---------------------- | ----------------------------------------- | ----------------------- | ---------------------------------- | ------------------------------------------ |
| Product sourced     | Distributor purchasing | Distributor orders bearings from supplier | ERP/procurement         | Future supply committed            | Inbound stock may cover demand             |
| Supplier dispatch   | Supplier/carrier       | Bearings leave supplier                   | Supplier/TMS            | Shipment in transit                | Arrival remains uncertain                  |
| Warehouse receipt   | Receiving worker       | Bearings arrive and are counted           | WMS                     | Usable on-hand inventory increases | Blocked orders may recover                 |
| Customer order      | Maintenance buyer      | Plant requests four bearings              | ERP/OMS                 | Customer demand increases          | Supply must be committed                   |
| Allocation          | Distributor            | Units are committed to the order          | OMS/allocation process  | Available inventory decreases      | Other orders may lose access               |
| Picking and packing | Warehouse worker       | Units are prepared for shipment           | WMS                     | Order progresses toward shipment   | Inventory is no longer generally available |
| Outbound shipment   | Carrier                | Package leaves distributor                | WMS/TMS                 | Order shipped                      | Fulfillment risk is resolved               |
| Customer receipt    | Customer               | Bearings arrive at plant                  | Carrier/customer system | Delivery completed                 | Customer operation can continue            |
