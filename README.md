
# Savan PayRise
secure HR-only MERN application designed to calculate annual salary increments for agriculture sales employees.

Performance evaluation is based on six key parameters: Sales Return, Sales Growth, NRV, Payment Collection, Activity, and Behaviour (maximum 18% increment).

Sales Growth, NRV, Payment Collection, Activity, and Behaviour follow a linear mapping: 0% performance equals 0% increment, and 100% equals 18% increment.

Sales Return follows a reverse performance rule: 0% return equals 18% increment, above 10% return results in 0% increment, and values between 0–10% are calculated linearly.

Seasonal increment is calculated as the average of Sales Return, Sales Growth, NRV, and Payment Collection.

Yearly per-metric increment is derived from the average of three seasons (Shiyadu, Unadu, and Chomasu).

The final annual increment (Option B) is computed as the average of six yearly performance components.

Increment Amount = Base Salary × (Final Increment % ÷ 100).

Total Salary = Base Salary + Increment, with subsequent year base salary automatically set to the previous year’s total salary.

The system includes Excel upload with intelligent column detection, backend APIs, and a structured HR dashboard interface.
