CREATE OR REPLACE FUNCTION handle_staff_details()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'staff' THEN
    INSERT INTO staff_details (id, is_active) VALUES (NEW.id, true)
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_staff_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_staff_details();
