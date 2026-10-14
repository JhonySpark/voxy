import React from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen } from 'lucide-react';
import styles from '../../pages/Register.module.css';

interface LegalDocumentContentProps {
  doc: 'terms' | 'privacy' | 'safety';
  mode: 'summary' | 'full';
  onSwitchMode: (mode: 'summary' | 'full') => void;
}

export const LegalDocumentContent: React.FC<LegalDocumentContentProps> = ({
  doc,
  mode,
  onSwitchMode,
}) => {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || 'pt').slice(0, 2);

  // ==========================================
  // TERMOS DE SERVIÇO (TERMS)
  // ==========================================
  if (doc === 'terms') {
    if (mode === 'summary') {
      if (lang === 'en') {
        return (
          <>
            <h3>1. Acceptance and Eligibility</h3>
            <p>
              By using Voxy, you declare that you are at least 13 years old and agree to these Terms of Service. Children under 13 cannot create an account on our platform.
            </p>
            <h3>2. Community Conduct Guidelines</h3>
            <p>
              Harassment, cyberstalking, hate speech, child exploitation or abuse, doxxing, and distributing malware or malicious files are strictly prohibited.
            </p>
            <h3>3. Servers and Communities</h3>
            <p>
              Server owners are directly responsible for moderating their respective rooms and channels. Voxy reserves the right to intervene and issue precautionary suspensions in case of imminent risk.
            </p>

            <div className="legal-summary-callout">
              <div className="legal-summary-callout-text">
                <div className="legal-summary-callout-title">
                  <BookOpen size={15} color="#34d399" />
                  <span>{t('auth.terms.calloutTitleTerms')}</span>
                </div>
                <p>{t('auth.terms.calloutDescTerms')}</p>
              </div>
              <button
                type="button"
                className="legal-summary-callout-btn"
                onClick={() => onSwitchMode('full')}
              >
                {t('auth.terms.readFullTerms')}
              </button>
            </div>
          </>
        );
      }

      if (lang === 'es') {
        return (
          <>
            <h3>1. Aceptación y Elegibilidad</h3>
            <p>
              Al utilizar Voxy, declaras tener al menos 13 años cumplidos y aceptar estos Términos de Servicio. Los menores de 13 años no pueden crear una cuenta en nuestra plataforma.
            </p>
            <h3>2. Directrices de Conducta de la Comunidad</h3>
            <p>
              Queda estrictamente prohibido el acoso, ciberacoso, incitación al odio, contenido de explotación o abuso infantil, doxxing o difusión de archivos maliciosos.
            </p>
            <h3>3. Servidores y Comunidades</h3>
            <p>
              Los propietarios de los servidores son los primeros responsables de moderar sus respectivas salas y canales. Voxy se reserva el derecho de intervenir y aplicar suspensiones cautelares en caso de riesgo inminente.
            </p>

            <div className="legal-summary-callout">
              <div className="legal-summary-callout-text">
                <div className="legal-summary-callout-title">
                  <BookOpen size={15} color="#34d399" />
                  <span>{t('auth.terms.calloutTitleTerms')}</span>
                </div>
                <p>{t('auth.terms.calloutDescTerms')}</p>
              </div>
              <button
                type="button"
                className="legal-summary-callout-btn"
                onClick={() => onSwitchMode('full')}
              >
                {t('auth.terms.readFullTerms')}
              </button>
            </div>
          </>
        );
      }

      return (
        <>
          <h3>1. Aceite e Elegibilidade</h3>
          <p>
            Ao utilizar o Voxy, você declara ter pelo menos 13 anos completos e concordar com estes Termos de Serviço. Menores de 13 anos não podem criar conta em nossa plataforma.
          </p>
          <h3>2. Diretrizes de Conduta da Comunidade</h3>
          <p>
            É estritamente vedada a prática de assédio, perseguição digital, propagação de discurso de ódio, conteúdo com exploração ou abuso de menores, doxxing ou disseminação de arquivos maliciosos.
          </p>
          <h3>3. Servidores e Comunidades</h3>
          <p>
            Os donos de servidor são os primeiros responsáveis pela moderação de suas respectivas salas e canais. O Voxy reserva-se o direito de intervir e aplicar suspensões cautelares em caso de risco iminente à integridade física ou psicológica de usuários.
          </p>

          <div className="legal-summary-callout">
            <div className="legal-summary-callout-text">
              <div className="legal-summary-callout-title">
                <BookOpen size={15} color="#34d399" />
                <span>{t('auth.terms.calloutTitleTerms')}</span>
              </div>
              <p>{t('auth.terms.calloutDescTerms')}</p>
            </div>
            <button
              type="button"
              className="legal-summary-callout-btn"
              onClick={() => onSwitchMode('full')}
            >
              {t('auth.terms.readFullTerms')}
            </button>
          </div>
        </>
      );
    }

    // FULL TERMS
    if (lang === 'en') {
      return (
        <>
          <div className={styles.legalDocFullHeader}>
            <div>
              <h2 className={styles.legalDocTitle}>Voxy Platform Terms of Service</h2>
              <span className={styles.legalDocVersion}>Version 1.0 • Updated in 2026 • Legal Terms</span>
            </div>
            <button
              type="button"
              className="legal-doc-back-pill"
              onClick={() => onSwitchMode('summary')}
            >
              {t('auth.terms.backToSummary')}
            </button>
          </div>

          <p>
            These Terms of Service ("Terms") govern access to and use of the services, desktop and web applications, low-latency voice channels, chat rooms, and game streaming provided by <strong>Voxy</strong>. By creating an account, you explicitly agree to these provisions.
          </p>

          <h3>1. Eligibility and Minimum Age</h3>
          <p>
            <strong>1.1. Prohibition for children under 13:</strong> Voxy is strictly not intended for children under 13. Registration is restricted in compliance with child safety legislation.
          </p>
          <p>
            <strong>1.2. Youth Accounts (13 to 17 years):</strong> Teenagers can access communication features with safety-by-design safeguards, including full-screen restrictions and automated block from 18+ servers.
          </p>
          <p>
            <strong>1.3. Adults (18+):</strong> Adult servers and mature game streaming are restricted exclusively to age-verified adult users.
          </p>

          <h3>2. Account and Security</h3>
          <p>
            <strong>2.1. Email Verification:</strong> All accounts must verify their email with a 6-digit verification code.
          </p>
          <p>
            <strong>2.2. Password Confidentiality:</strong> Users are solely responsible for protecting their credentials.
          </p>

          <h3>3. Prohibited Conduct</h3>
          <p>Users agree not to engage in harassment, hate speech, distributing malware, or exposing private data (doxxing).</p>

          <h3>4. Voice and Screen Transmission</h3>
          <p>
            All media transmissions via WebRTC are ephemeral in real time. Voxy does not record or store your calls.
          </p>
        </>
      );
    }

    if (lang === 'es') {
      return (
        <>
          <div className={styles.legalDocFullHeader}>
            <div>
              <h2 className={styles.legalDocTitle}>Términos de Uso de la Plataforma Voxy</h2>
              <span className={styles.legalDocVersion}>Versión 1.0 • Actualizada en 2026 • Términos Legales</span>
            </div>
            <button
              type="button"
              className="legal-doc-back-pill"
              onClick={() => onSwitchMode('summary')}
            >
              {t('auth.terms.backToSummary')}
            </button>
          </div>

          <p>
            Estos Términos de Uso ("Términos") rigen el acceso y uso de los servicios, aplicaciones de escritorio y web, canales de voz de baja latencia y streaming ofrecidos por <strong>Voxy</strong>.
          </p>

          <h3>1. Elegibilidad y Edad Mínima Obligatoria</h3>
          <p>
            <strong>1.1. Menores de 13 años:</strong> Voxy no está destinado a niños menores de 13 años. El registro está restringido por diseño.
          </p>
          <p>
            <strong>1.2. Cuentas Jóvenes (13 a 17 años):</strong> Los adolescentes cuentan con salvaguardas de seguridad por diseño activas y bloqueo de comunidades +18.
          </p>
          <p>
            <strong>1.3. Adultos (18+):</strong> Las comunidades adultas están restringidas exclusivamente a usuarios clasificados como adultos.
          </p>

          <h3>2. Cuenta y Seguridad</h3>
          <p>
            Todas las cuentas deben validar su correo con un código de 6 dígitos antes de habilitar el acceso.
          </p>

          <h3>3. Conductas Prohibidas</h3>
          <p>Queda prohibido el acoso, ciberacoso, lenguaje de odio o divulgación no autorizada de datos personales.</p>

          <h3>4. Transmisión Efímera</h3>
          <p>Voxy no graba ni almacena en disco los flujos de voz o video de las llamadas.</p>
        </>
      );
    }

    return (
      <>
        <div className={styles.legalDocFullHeader}>
          <div>
            <h2 className={styles.legalDocTitle}>Termos de Uso da Plataforma Voxy</h2>
            <span className={styles.legalDocVersion}>Versão 1.0 • Atualizada em Março de 2026 • Legislação Brasileira</span>
          </div>
          <button
            type="button"
            className="legal-doc-back-pill"
            onClick={() => onSwitchMode('summary')}
          >
            {t('auth.terms.backToSummary')}
          </button>
        </div>

        <p>
          Estes Termos de Uso ("Termos") regem o acesso e a utilização dos serviços, aplicativos para desktop e web, canais de voz de baixa latência, salas de bate-papo e streaming de jogos oferecidos pela plataforma <strong>Voxy</strong>. Ao criar uma conta ou utilizar o serviço, você declara expressamente que leu, compreendeu e concorda com as disposições abaixo.
        </p>

        <h3>1. Elegibilidade e Idade Mínima Obrigatória</h3>
        <p>
          <strong>1.1. Proibição a menores de 13 anos:</strong> O Voxy não é destinado a crianças menores de 13 (treze) anos. O cadastro é tecnologicamente restrito e bloqueado na raiz da aplicação em cumprimento à legislação brasileira de proteção de dados.
        </p>
        <p>
          <strong>1.2. Contas Jovens (13 a 17 anos):</strong> Adolescentes podem utilizar os recursos sociais com salvaguardas ativas de segurança por design, incluindo restrição de captura de telas genéricas e bloqueio automático de entrada em ambientes marcados como +18.
        </p>
        <p>
          <strong>1.3. Maiores de 18 Anos:</strong> A criação de servidores com conteúdo adulto e a transmissão de jogos categorizados como maduros é restrita exclusivamente a usuários com classificação etária confirmada como adultos (ADULT).
        </p>

        <h3>2. Cadastro, Conta e Segurança das Credenciais</h3>
        <p>
          <strong>2.1. Validação de E-mail Obrigatória:</strong> Todas as novas contas devem validar a posse do endereço de e-mail por meio de token transacional de 6 dígitos antes da liberação dos canais sociais.
        </p>
        <p>
          <strong>2.2. Guarda de Senha:</strong> O usuário é o único responsável pela guarda e confidencialidade de suas credenciais de acesso. Atividades realizadas a partir de sua conta serão atribuídas ao respectivo titular.
        </p>
        <p>
          <strong>2.3. Pessoal e Intransferível:</strong> É vedada a venda, locação ou cessão de contas a terceiros.
        </p>

        <h3>3. Diretrizes de Conduta e Usos Expressamente Proibidos</h3>
        <p>Ao utilizar o Voxy, o usuário se compromete solenemente a <strong>NÃO</strong>:</p>
        <ul>
          <li>Praticar qualquer conduta que coloque em risco crianças ou adolescentes, incluindo aliciamento (grooming), envio de material inadequado ou compartilhamento de pornografia infantil;</li>
          <li>Praticar assédio, perseguição digital (cyberstalking), ameaças de violência ou discurso de ódio baseado em raça, gênero, religião ou orientação sexual;</li>
          <li>Transmitir conteúdo sexual explícito, pornografia, nudez não consentida ou violência gráfica excessiva;</li>
          <li>Praticar doxxing, expondo dados pessoais, documentos ou endereços de terceiros sem autorização;</li>
          <li>Disseminar vírus, malwares, keyloggers ou links fraudulentos de phishing;</li>
          <li>Utilizar automações abusivas, sobrecarregar os servidores ou realizar ataques de negação de serviço.</li>
        </ul>

        <h3>4. Transmissão de Tela e Streaming de Jogos</h3>
        <p>
          <strong>4.1. Foco em Gameplay:</strong> A tecnologia de transmissão do Voxy é primariamente orientada à captura de janelas de processos de jogos detectados.
        </p>
        <p>
          <strong>4.2. Efemeridade:</strong> O Voxy não grava nem armazena em disco fluxos de áudio de chamadas de voz ou vídeo de transmissões. Todas as mídias são efêmeras em tempo real via WebRTC.
        </p>

        <h3>5. Responsabilidade dos Donos e Moderadores de Servidores</h3>
        <p>
          Os criadores e moderadores de servidores são responsáveis pela harmonia e moderação diária de suas comunidades, devendo utilizar as ferramentas de silenciamento, expulsão e banimento contra infratores.
        </p>

        <h3>6. Foro e Resolução de Disputas</h3>
        <p>
          Estes Termos são regidos pelo ordenamento jurídico brasileiro (Marco Civil da Internet, LGPD e Código de Defesa do Consumidor).
        </p>
      </>
    );
  }

  // ==========================================
  // POLÍTICA DE PRIVACIDADE (PRIVACY)
  // ==========================================
  if (doc === 'privacy') {
    if (mode === 'summary') {
      if (lang === 'en') {
        return (
          <>
            <h3>1. Privacy Commitment (LGPD & Privacy by Design)</h3>
            <p>
              Voxy operates under strict principles of <strong>data minimization</strong> and <strong>ephemerality</strong>. We do not sell your personal data and do not run tracking advertisements.
            </p>
            <h3>2. Real-Time Audio & Video Streams</h3>
            <p>
              Voice channels (WebRTC) and game capture are ephemeral real-time streams. <strong>Voxy does not record or store your voice calls or video on disk.</strong>
            </p>
            <h3>3. Processing Data of Minors</h3>
            <p>
              Processing data of teenagers (13-17) is carried out strictly in their best interest, without behavioral profiling.
            </p>

            <div className="legal-summary-callout">
              <div className="legal-summary-callout-text">
                <div className="legal-summary-callout-title">
                  <BookOpen size={15} color="#60a5fa" />
                  <span>{t('auth.terms.calloutTitlePrivacy')}</span>
                </div>
                <p>{t('auth.terms.calloutDescPrivacy')}</p>
              </div>
              <button
                type="button"
                className="legal-summary-callout-btn"
                onClick={() => onSwitchMode('full')}
              >
                {t('auth.terms.readFullPrivacy')}
              </button>
            </div>
          </>
        );
      }

      if (lang === 'es') {
        return (
          <>
            <h3>1. Compromiso con la Privacidad (LGPD y Privacidad por Diseño)</h3>
            <p>
              Voxy opera bajo los principios de <strong>minimización de datos</strong> y <strong>efimeridad</strong>. No vendemos datos personales y no incluimos publicidad de rastreo.
            </p>
            <h3>2. Transmisiones de Audio y Video en Tiempo Real</h3>
            <p>
              Las transmisiones de voz (WebRTC) y capturas de pantalla son efímeras. <strong>Voxy no graba ni almacena en disco el contenido de audio o video de tus llamadas.</strong>
            </p>
            <h3>3. Tratamiento de Datos de Menores</h3>
            <p>
              El tratamiento de datos de adolescentes (13 a 17 años) se realiza en estricto cumplimiento de su interés superior, sin creación de perfiles de comportamiento.
            </p>

            <div className="legal-summary-callout">
              <div className="legal-summary-callout-text">
                <div className="legal-summary-callout-title">
                  <BookOpen size={15} color="#60a5fa" />
                  <span>{t('auth.terms.calloutTitlePrivacy')}</span>
                </div>
                <p>{t('auth.terms.calloutDescPrivacy')}</p>
              </div>
              <button
                type="button"
                className="legal-summary-callout-btn"
                onClick={() => onSwitchMode('full')}
              >
                {t('auth.terms.readFullPrivacy')}
              </button>
            </div>
          </>
        );
      }

      return (
        <>
          <h3>1. Compromisso com a Privacidade (LGPD & ANPD)</h3>
          <p>
            O Voxy opera sob princípios de <strong>minimização de dados</strong> e <strong>efemeridade</strong>. Não vendemos dados pessoais e não veiculamos publicidade rastreadora.
          </p>
          <h3>2. Transmissões de Áudio e Vídeo em Tempo Real</h3>
          <p>
            As transmissões de voz (WebRTC) e captura de tela de jogos são fluxos efêmeros em tempo real. <strong>O Voxy não grava nem armazena em disco o conteúdo de áudio ou vídeo das suas chamadas.</strong>
          </p>
          <h3>3. Tratamento de Dados de Menores</h3>
          <p>
            O tratamento de dados de adolescentes entre 13 e 17 anos é efetuado em estrita observância ao seu melhor interesse (Art. 14 da LGPD), sem criação de perfis comportamentais.
          </p>

          <div className="legal-summary-callout">
            <div className="legal-summary-callout-text">
              <div className="legal-summary-callout-title">
                <BookOpen size={15} color="#60a5fa" />
                <span>{t('auth.terms.calloutTitlePrivacy')}</span>
              </div>
              <p>{t('auth.terms.calloutDescPrivacy')}</p>
            </div>
            <button
              type="button"
              className="legal-summary-callout-btn"
              onClick={() => onSwitchMode('full')}
            >
              {t('auth.terms.readFullPrivacy')}
            </button>
          </div>
        </>
      );
    }

    // FULL PRIVACY
    return (
      <>
        <div className={styles.legalDocFullHeader}>
          <div>
            <h2 className={styles.legalDocTitle}>
              {lang === 'en'
                ? 'Privacy and Data Protection Policy'
                : lang === 'es'
                ? 'Política de Privacidad y Protección de Datos'
                : 'Política de Privacidade e Proteção de Dados (LGPD)'}
            </h2>
            <span className={styles.legalDocVersion}>
              {lang === 'en'
                ? 'Compliance with LGPD regulations • Version 1.0'
                : lang === 'es'
                ? 'Conformidad con regulaciones de privacidad • Versión 1.0'
                : 'Conformidade com a Lei nº 13.709/2018 (LGPD) e Orientações da ANPD • Versão 1.0'}
            </span>
          </div>
          <button
            type="button"
            className="legal-doc-back-pill"
            onClick={() => onSwitchMode('summary')}
          >
            {t('auth.terms.backToSummary')}
          </button>
        </div>

        <p>
          {lang === 'en'
            ? 'Voxy adopts the principle of Privacy by Design. We do not sell your personal data, do not display behavioral ads, and collect only the bare minimum needed to connect you with friends.'
            : lang === 'es'
            ? 'Voxy adopta el principio de Privacidad por Diseño. No vendemos tus datos a intermediarios, no mostramos anuncios conductuales y recopilamos solo lo indispensable.'
            : 'O Voxy adota o princípio da privacidade por padrão (Privacy by Design). Não vendemos seus dados para corretores de dados, não exibimos anúncios comportamentais e coletamos apenas o estritamente indispensável para conectar você aos seus amigos.'}
        </p>

        <h3>1. {lang === 'en' ? 'Categories of Data Collected' : lang === 'es' ? 'Categorías de Datos Recopilados' : 'Categorias de Dados Pessoais Coletados'}</h3>
        <table className="legal-table">
          <thead>
            <tr>
              <th>{lang === 'en' ? 'Data' : lang === 'es' ? 'Dato' : 'Dado'}</th>
              <th>{lang === 'en' ? 'Purpose' : lang === 'es' ? 'Finalidad' : 'Finalidade'}</th>
              <th>{lang === 'en' ? 'Legal Basis' : lang === 'es' ? 'Base Legal' : 'Base Legal (LGPD)'}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Email, Nickname, Password</td>
              <td>{lang === 'en' ? 'Account authentication and security' : lang === 'es' ? 'Autenticación y seguridad de la cuenta' : 'Autenticação e segurança da conta'}</td>
              <td>Contract Execution</td>
            </tr>
            <tr>
              <td>{lang === 'en' ? 'Date of Birth' : lang === 'es' ? 'Fecha de Nacimiento' : 'Data de Nascimento'}</td>
              <td>{lang === 'en' ? 'Age-appropriate safeguards and minor protection' : lang === 'es' ? 'Protección de menores' : 'Salvaguarda etária e proteção de menores'}</td>
              <td>Legal Obligation</td>
            </tr>
            <tr>
              <td>Voice & Screen Streams</td>
              <td>{lang === 'en' ? 'Real-time communication (not recorded)' : lang === 'es' ? 'Comunicación en tiempo real (no grabada)' : 'Comunicação em tempo real (não é gravada)'}</td>
              <td>Contract Execution</td>
            </tr>
          </tbody>
        </table>

        <h3>2. {lang === 'en' ? 'Voice and Video Calls are 100% Ephemeral' : lang === 'es' ? 'Llamadas de Voz y Video son 100% Efímeras' : 'Chamadas de Voz e Vídeo são 100% Efêmeras'}</h3>
        <p>
          {lang === 'en'
            ? 'Voice and video traffic travels directly via encrypted protocols (WebRTC with SRTP/DTLS). We do not record, transcribe, or store audio conversations in any database.'
            : lang === 'es'
            ? 'El tráfico de voz y video viaja cifrado mediante WebRTC. No grabamos ni almacenamos conversaciones de audio en ninguna base de datos.'
            : 'O tráfego de voz e vídeo trafega diretamente por protocolos criptografados (WebRTC com SRTP/DTLS). Não gravamos, não transcrevemos e não guardamos conversas de áudio em nenhuma base de dados.'}
        </p>
      </>
    );
  }

  // ==========================================
  // SEGURANÇA INFANTIL (SAFETY)
  // ==========================================
  if (mode === 'summary') {
    if (lang === 'en') {
      return (
        <>
          <h3>1. Child and Youth Safety by Design</h3>
          <p>
            Our platform adopts proactive safety mechanisms to offer age-appropriate digital experiences.
          </p>
          <h3>2. Youth Account Protection (13 to 17 years)</h3>
          <p>
            Teenagers have active restrictions against generic screen sharing and are blocked from 18+ communities.
          </p>
          <h3>3. Zero Tolerance for Abuse</h3>
          <p>
            Any indication or attempt of child exploitation results in immediate account ban and cooperation with authorities.
          </p>

          <div className="legal-summary-callout">
            <div className="legal-summary-callout-text">
              <div className="legal-summary-callout-title">
                <BookOpen size={15} color="#c084fc" />
                <span>{t('auth.terms.calloutTitleSafety')}</span>
              </div>
              <p>{t('auth.terms.calloutDescSafety')}</p>
            </div>
            <button
              type="button"
              className="legal-summary-callout-btn"
              onClick={() => onSwitchMode('full')}
            >
              {t('auth.terms.readFullSafety')}
            </button>
          </div>
        </>
      );
    }

    if (lang === 'es') {
      return (
        <>
          <h3>1. Seguridad Infantil por Diseño</h3>
          <p>
            Nuestra plataforma adopta mecanismos de seguridad activos para ofrecer una experiencia adecuada a la edad.
          </p>
          <h3>2. Protección de Cuentas Juveniles (13 a 17 años)</h3>
          <p>
            Los adolescentes tienen restricciones para compartir pantallas completas y no pueden ingresar a comunidades +18.
          </p>
          <h3>3. Tolerancia Cero con el Abuso</h3>
          <p>
            Cualquier intento de abuso o explotación infantil resulta en la suspensión inmediata y cooperación policial.
          </p>

          <div className="legal-summary-callout">
            <div className="legal-summary-callout-text">
              <div className="legal-summary-callout-title">
                <BookOpen size={15} color="#c084fc" />
                <span>{t('auth.terms.calloutTitleSafety')}</span>
              </div>
              <p>{t('auth.terms.calloutDescSafety')}</p>
            </div>
            <button
              type="button"
              className="legal-summary-callout-btn"
              onClick={() => onSwitchMode('full')}
            >
              {t('auth.terms.readFullSafety')}
            </button>
          </div>
        </>
      );
    }

    return (
      <>
        <h3>1. Conformidade com o ECA Digital</h3>
        <p>
          Nossa plataforma adota mecanismos de proteção por design (safety by design) para oferecer uma experiência adequada à idade.
        </p>
        <h3>2. Proteção de Contas Jovens (13 a 17 anos)</h3>
        <p>
          Adolescentes possuem restrições ativas para transmissões genéricas de tela e impedimento de acesso a comunidades marcadas como +18.
        </p>
        <h3>3. Tolerância Zero a Abusos</h3>
        <p>
          Qualquer indício ou tentativa de exploração infantil resultará no banimento imediato da conta, registro de logs de auditoria técnica e cooperação irrestrita com autoridades policiais competentes.
        </p>

        <div className="legal-summary-callout">
          <div className="legal-summary-callout-text">
            <div className="legal-summary-callout-title">
              <BookOpen size={15} color="#c084fc" />
              <span>{t('auth.terms.calloutTitleSafety')}</span>
            </div>
            <p>{t('auth.terms.calloutDescSafety')}</p>
          </div>
          <button
            type="button"
            className="legal-summary-callout-btn"
            onClick={() => onSwitchMode('full')}
          >
            {t('auth.terms.readFullSafety')}
          </button>
        </div>
      </>
    );
  }

  // FULL SAFETY
  return (
    <>
      <div className={styles.legalDocFullHeader}>
        <div>
          <h2 className={styles.legalDocTitle}>
            {lang === 'en'
              ? 'Child and Youth Protection Guidelines'
              : lang === 'es'
              ? 'Directrices de Protección a la Infancia y Adolescencia'
              : 'Proteção à Criança e ao Adolescente (ECA Digital)'}
          </h2>
          <span className={styles.legalDocVersion}>
            {lang === 'en'
              ? 'Safety by Design guidelines • Version 1.0'
              : lang === 'es'
              ? 'Directrices de seguridad por diseño • Versión 1.0'
              : 'Em conformidade com a Lei nº 8.069/1990 (ECA) e Diretrizes Preliminares da ANPD'}
          </span>
        </div>
        <button
          type="button"
          className="legal-doc-back-pill"
          onClick={() => onSwitchMode('summary')}
        >
          {t('auth.terms.backToSummary')}
        </button>
      </div>

      <p>
        {lang === 'en'
          ? 'Voxy adopts proactive safeguards to guarantee safe, respectful, and abuse-free digital environments for teenagers and youth.'
          : lang === 'es'
          ? 'Voxy adopta salvaguardas activas para garantizar entornos digitales seguros, respetuosos y libres de abusos para adolescentes y jóvenes.'
          : 'O Voxy adota uma postura de salvaguardas ativas para garantir ambientes digitais seguros, respeitosos e livres de abusos para adolescentes e jovens.'}
      </p>

      <h3>1. {lang === 'en' ? 'Layered Age Model' : lang === 'es' ? 'Modelo de Capas por Edad' : 'Modelo em Camadas de Proteção Etária'}</h3>
      <p>
        • <strong>{lang === 'en' ? 'Children (under 13):' : lang === 'es' ? 'Niños (menores de 13 años):' : 'Crianças (menores de 13 anos):'}</strong>{' '}
        {lang === 'en'
          ? 'Registration is technologically prohibited and blocked at root.'
          : lang === 'es'
          ? 'Registro tecnológicamente prohibido y bloqueado de raíz.'
          : 'Cadastro tecnologicamente proibido e bloqueado.'}
      </p>
      <p>
        • <strong>{lang === 'en' ? 'Teenagers (13 to 17 years):' : lang === 'es' ? 'Adolescentes (13 a 17 años):' : 'Adolescentes (13 a 17 anos):'}</strong>{' '}
        {lang === 'en'
          ? 'May communicate via voice/text and stream detected games. Cannot share entire desktop screen and cannot enter 18+ communities.'
          : lang === 'es'
          ? 'Pueden comunicarse por voz/texto y transmitir juegos detectados. No pueden compartir pantallas genéricas ni acceder a comunidades +18.'
          : 'Podem se comunicar em voz e texto e transmitir gameplay de jogos reconhecidos. Não podem compartilhar telas inteiras ou janelas genéricas do sistema operacional, e são impedidos de visualizar ou ingressar em comunidades +18.'}
      </p>
      <p>
        • <strong>{lang === 'en' ? 'Adults (18+):' : lang === 'es' ? 'Adultos (18+):' : 'Adultos (18+ anos):'}</strong>{' '}
        {lang === 'en'
          ? 'Permitted to create adult environments and stream any window.'
          : lang === 'es'
          ? 'Permiso para crear ambientes adultos y transmitir cualquier ventana.'
          : 'Possuem permissão para criar ambientes adultos e transmitir qualquer janela.'}
      </p>

      <h3>2. {lang === 'en' ? 'Zero Tolerance Policy' : lang === 'es' ? 'Política de Tolerancia Cero' : 'Tolerância Zero com Abuso e Exploração'}</h3>
      <p>
        {lang === 'en'
          ? 'The platform maintains strict zero tolerance for child sexual abuse material and grooming. Any violation leads to immediate account termination and police referral.'
          : lang === 'es'
          ? 'La plataforma mantiene tolerancia cero con material de abuso y explotación infantil. Cualquier incidente resulta en la cancelación de la cuenta y remisión policial.'
          : 'A plataforma mantém política de tolerância zero com material de exploração sexual infantil (CSAM/CSAE) e aliciamento (grooming). Qualquer incidente resulta no encerramento imediato da conta, registro de logs de auditoria e envio das informações às autoridades policiais competentes.'}
      </p>
    </>
  );
};
