type RadarSocialComingSoonProps = {
  label: string;
  description?: string;
};

export function RadarSocialComingSoon({
  label,
  description = "Monitoramento de perfis em redes sociais entrará em uma próxima versão.",
}: RadarSocialComingSoonProps) {
  return (
    <div className="persona-form-group radar-social-coming-soon">
      <p className="persona-label">{label}</p>
      <div className="radar-social-coming-soon-box" role="status">
        <p className="radar-social-coming-soon-message">Disponível em breve</p>
        <p className="persona-helper-text">{description}</p>
      </div>
    </div>
  );
}
