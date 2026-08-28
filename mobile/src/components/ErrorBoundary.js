import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

// Attrape toute erreur de rendu React et l'affiche à l'écran au lieu de laisser
// l'appli planter sur un écran blanc silencieux. Utile tant qu'on n'a pas de
// logs de build accessibles facilement (pas de Mac, logs GitHub Actions bloqués).
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.title}>💥 Erreur au démarrage</Text>
            <Text style={styles.message}>{String(this.state.error?.message || this.state.error)}</Text>
            <Text style={styles.stack}>{String(this.state.error?.stack || '')}</Text>
            {this.state.info ? (
              <Text style={styles.stack}>{String(this.state.info.componentStack || '')}</Text>
            ) : null}
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#11131c', paddingTop: 60 },
  scroll: { padding: 16 },
  title: { fontSize: 18, fontWeight: '800', color: '#ff6b6b', marginBottom: 12 },
  message: { fontSize: 14, color: '#eef0f6', marginBottom: 12 },
  stack: { fontSize: 11, color: '#8d93ab' },
});
