import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      "app.title": "Voxy",
      "auth.login.title": "Welcome to Voxy",
      "auth.login.subtitle": "We're so excited to see you again!",
      "auth.login.email": "Email",
      "auth.login.password": "Password",
      "auth.login.button": "Log In",
      "auth.login.noAccount": "Need an account?",
      "auth.login.register": "Register",
      
      "auth.register.title": "Create an account",
      "auth.register.subtitle": "Join Voxy today!",
      "auth.register.username": "Username",
      "auth.register.email": "Email",
      "auth.register.password": "Password",
      "auth.register.button": "Register",
      "auth.register.hasAccount": "Already have an account?",
      
      "sidebar.search": "Find or start a conversation",
      "sidebar.directMessages": "Direct Messages",
      "sidebar.friends": "Friends",
      
      "friends.addFriend": "Add Friend",
      "friends.addFriendPlaceholder": "Enter username",
      "friends.addFriendButton": "Send Friend Request",
      "friends.pendingRequests": "Pending Requests",
      "friends.allFriends": "All Friends",
      
      "server.addServer": "Add a Server",
      "server.createServer": "Create Server",
      "server.createServerButton": "Create",
      "server.joinServer": "Join Server",
      "server.joinServerPlaceholder": "Invite Code",
      "server.joinServerButton": "Join",
      "server.inviteFriends": "Invite Friends",
      
      "chat.messagePlaceholder": "Message",
      "chat.you": "You",
      
      "voice.connected": "Voice Connected",
      "voice.clickToJoin": "Click the channel again to join voice.",
      "voice.youScreen": "You (Screen)",
      "voice.remoteUser": "Remote User",
      "voice.shareScreen": "Share your screen",
      "voice.cancel": "Cancel",
      
      "settings.title": "Settings",
      "settings.language": "Language",
      "settings.logout": "Log Out"
    }
  },
  pt: {
    translation: {
      "app.title": "Voxy",
      "auth.login.title": "Bem-vindo(a) ao Voxy",
      "auth.login.subtitle": "Estamos muito felizes em te ver novamente!",
      "auth.login.email": "E-mail",
      "auth.login.password": "Senha",
      "auth.login.button": "Entrar",
      "auth.login.noAccount": "Precisa de uma conta?",
      "auth.login.register": "Registre-se",
      
      "auth.register.title": "Criar uma conta",
      "auth.register.subtitle": "Junte-se ao Voxy hoje!",
      "auth.register.username": "Nome de usuário",
      "auth.register.email": "E-mail",
      "auth.register.password": "Senha",
      "auth.register.button": "Registrar",
      "auth.register.hasAccount": "Já tem uma conta?",
      
      "sidebar.search": "Encontre ou inicie uma conversa",
      "sidebar.directMessages": "Mensagens Diretas",
      "sidebar.friends": "Amigos",
      
      "friends.addFriend": "Adicionar Amigo",
      "friends.addFriendPlaceholder": "Digite o usuário",
      "friends.addFriendButton": "Enviar Solicitação",
      "friends.pendingRequests": "Solicitações Pendentes",
      "friends.allFriends": "Todos os Amigos",
      
      "server.addServer": "Adicionar Servidor",
      "server.createServer": "Criar Servidor",
      "server.createServerButton": "Criar",
      "server.joinServer": "Entrar no Servidor",
      "server.joinServerPlaceholder": "Código de Convite",
      "server.joinServerButton": "Entrar",
      "server.inviteFriends": "Convidar Amigos",
      
      "chat.messagePlaceholder": "Mensagem",
      "chat.you": "Você",
      
      "voice.connected": "Voz Conectada",
      "voice.clickToJoin": "Clique no canal novamente para entrar.",
      "voice.youScreen": "Você (Tela)",
      "voice.remoteUser": "Usuário Remoto",
      "voice.shareScreen": "Compartilhar sua tela",
      "voice.cancel": "Cancelar",
      
      "settings.title": "Configurações",
      "settings.language": "Idioma",
      "settings.logout": "Sair da Conta"
    }
  }
};

const savedLanguage = localStorage.getItem('voxy-language') || 'en';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;
