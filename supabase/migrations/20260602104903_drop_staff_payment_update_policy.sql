-- Drop the existing policy that allows staff to update payments
DROP POLICY IF EXISTS payments_update_staff ON public.payments;
