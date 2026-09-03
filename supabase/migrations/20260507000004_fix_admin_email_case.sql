CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
BEGIN
  -- Usando LOWER() para garantir que Admin@... e admin@... funcionem igual
  RETURN LOWER((SELECT email FROM auth.users WHERE id = auth.uid())) = 'admin@bonuscred.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
