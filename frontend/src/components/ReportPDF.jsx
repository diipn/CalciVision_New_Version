import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { 
    padding: 18,
    fontFamily: 'Helvetica',
    fontSize: 9,
    lineHeight: 1.15,
    color: '#24332B'
  },
  header: {
    marginBottom: 10,
    borderBottom: '1.5 solid #5E8C6A',
    paddingBottom: 5
  },
  title: {
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 3,
    color: '#5E8C6A',
    letterSpacing: 0.3
  },
  subtitle: {
    fontSize: 9.5,
    fontWeight: 'normal',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 6,
    color: '#6C7A72',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  patientInfo: {
    marginBottom: 10,
    padding: 7,
    backgroundColor: '#E9F2EC',
    borderRadius: 3,
    border: '1 solid #D4E4D8'
  },
  sectionTitle: {
    fontSize: 9.5,
    fontWeight: 'bold',
    marginTop: 6,
    marginBottom: 4,
    color: '#5E8C6A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottom: '1 solid #E8E8E8',
    paddingBottom: 1.5
  },
  paragraph: {
    marginBottom: 3,
    textAlign: 'justify',
    lineHeight: 1.2
  },
  findings: {
    marginLeft: 8,
    marginBottom: 2,
    fontSize: 8.5
  },
  conclusion: {
    marginTop: 6,
    padding: 7,
    backgroundColor: '#F3F6F4',
    borderRadius: 3,
    border: '1 solid #C8D2CB'
  },
  signature: {
    marginTop: 12,
    textAlign: 'center',
    borderTop: '1 solid #E8E8E8',
    paddingTop: 10
  },
  date: {
    textAlign: 'right',
    fontSize: 8,
    color: '#6C7A72',
    marginBottom: 2
  },
  institutionHeader: {
    textAlign: 'center',
    marginBottom: 8,
    padding: 5,
    backgroundColor: '#F3F6F4',
    borderRadius: 3
  },
  institutionName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#24332B',
    marginBottom: 1
  },
  institutionDetails: {
    fontSize: 7.5,
    color: '#6C7A72'
  },
  patientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 1.5
  },
  patientLabel: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#24332B',
    width: '35%'
  },
  patientValue: {
    fontSize: 8.5,
    color: '#24332B',
    width: '65%'
  },
  findingItem: {
    flexDirection: 'row',
    marginBottom: 1.5,
    alignItems: 'flex-start'
  },
  findingBullet: {
    fontSize: 8.5,
    color: '#5E8C6A',
    marginRight: 4,
    marginTop: 1
  },
  findingText: {
    fontSize: 8,
    flex: 1,
    lineHeight: 1.15
  },
  highlight: {
    backgroundColor: '#D8C89A',
    padding: 1,
    borderRadius: 1
  },
  divider: {
    height: 0.5,
    backgroundColor: '#E8E8E8',
    marginVertical: 4
  },
  pageBreak: {
    break: 'before'
  },
  compactSection: {
    marginTop: 4,
    marginBottom: 3
  },
  pageNumber: {
    position: 'absolute',
    fontSize: 8,
    bottom: 10,
    right: 18,
    color: '#6C7A72'
  }
});

const ReportPDF = ({ data, patient, medico, calciumScore, reportText }) => {
  const hasCalcification = data.some(item => item.is_calcified);
  const calcifiedFrames = data.filter(item => item.is_calcified).length;
  const totalFrames = data.length;
  const calcificationPercentage = totalFrames > 0 ? ((calcifiedFrames / totalFrames) * 100).toFixed(1) : 0;
  const scoreValue = calciumScore !== null && calciumScore !== undefined ? Number(calciumScore) : null;
  const score100 = scoreValue !== null && !Number.isNaN(scoreValue) ? Math.round(scoreValue * 100) : null;
  const currentDate = new Date().toLocaleDateString('pt-PT', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  });

  return (
  <Document>
    {/* PAGE 1 - Patient Information and Technical Data */}
    <Page style={styles.page}>
      {/* Institution Header */}
      <View style={styles.institutionHeader}>
        <Text style={styles.institutionName}>CALCIVISION</Text>
        <Text style={styles.institutionDetails}>Sistema de análise ecocardiográfica assistida</Text>
      </View>

      {/* Date */}
      <Text style={styles.date}>Data: {currentDate}</Text>

      {/* Main Header */}
      <View style={styles.header}>
        <Text style={styles.title}>RELATÓRIO ECOCARDIOGRÁFICO</Text>
        <Text style={styles.subtitle}>Avaliação da válvula aórtica</Text>
      </View>

      {/* Patient Information */}
      <View style={styles.patientInfo}>
        <Text style={styles.sectionTitle}>DADOS DO PACIENTE</Text>
        <View style={styles.patientRow}>
          <Text style={styles.patientLabel}>Nome:</Text>
          <Text style={styles.patientValue}>{patient.name}</Text>
        </View>
        <View style={styles.patientRow}>
          <Text style={styles.patientLabel}>Idade:</Text>
          <Text style={styles.patientValue}>{patient.age} anos</Text>
        </View>
        <View style={styles.patientRow}>
          <Text style={styles.patientLabel}>Data do exame:</Text>
          <Text style={styles.patientValue}>{currentDate}</Text>
        </View>
        <View style={styles.patientRow}>
          <Text style={styles.patientLabel}>Médico responsável:</Text>
          <Text style={styles.patientValue}>Dr. {medico.first_name} {medico.last_name}</Text>
        </View>
      </View>

      {/* Clinical Indication */}
      <View style={styles.compactSection}>
        <Text style={styles.sectionTitle}>INDICAÇÃO CLÍNICA</Text>
        <Text style={styles.paragraph}>
          Avaliação ecocardiográfica da válvula aórtica para investigação de calcificação valvular com apoio de análise por IA.
        </Text>
      </View>

      {/* Technical Data */}
      <View style={styles.compactSection}>
        <Text style={styles.sectionTitle}>DADOS TÉCNICOS</Text>
        <Text style={styles.paragraph}>
          Exame realizado com equipamento de ultrassom cardíaco, com deteção automática de calcificação valvular.
        </Text>
        
        <View style={styles.findingItem}>
          <Text style={styles.findingBullet}>•</Text>
          <Text style={styles.findingText}>Total de frames analisados: <Text style={styles.highlight}>{totalFrames}</Text></Text>
        </View>
        
        <View style={styles.findingItem}>
          <Text style={styles.findingBullet}>•</Text>
          <Text style={styles.findingText}>Frames com calcificação detetada: <Text style={styles.highlight}>{calcifiedFrames}</Text></Text>
        </View>
        
        <View style={styles.findingItem}>
          <Text style={styles.findingBullet}>•</Text>
          <Text style={styles.findingText}>Percentagem de calcificação: <Text style={styles.highlight}>{calcificationPercentage}%</Text></Text>
        </View>
        <View style={styles.findingItem}>
          <Text style={styles.findingBullet}>•</Text>
          <Text style={styles.findingText}>
            Calcium score (0-100): <Text style={styles.highlight}>{score100 !== null ? score100 : "N/A"}</Text>
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* REGION OF INTEREST ANNOTATIONS - MOVED TO PAGE 1 */}
      <View style={styles.compactSection}>
        <Text style={styles.sectionTitle}>ANOTAÇÕES DA REGIÃO DE INTERESSE</Text>
        <Text style={styles.paragraph}>
          Coordenadas das regiões anatómicas identificadas para análise da válvula aórtica:
        </Text>
        
        {data.slice(0, Math.min(data.length, 6)).map((frame, index) => {
          if (!frame.rects || frame.rects.length === 0) return null;
          
          const rect = frame.rects;
          const isAIGenerated = frame.is_annotation_generated;
          
          return (
            <View key={index} style={styles.findingItem}>
              <Text style={styles.findingBullet}>•</Text>
              <Text style={styles.findingText}>
                Frame {index + 1}: ({Math.round(rect.x)}, {Math.round(rect.y)}) - 
                {Math.round(rect.width)}×{Math.round(rect.height)}px
                {isAIGenerated && (
                  <Text style={{fontSize: 7, color: '#6C7A72'}}> (IA)</Text>
                )}
              </Text>
            </View>
          );
        })}
        
        {data.length > 6 && (
          <Text style={{fontSize: 8, color: '#6C7A72', marginTop: 2}}>
            ... e mais {data.length - 6} coordenadas (detalhes na página 2)
          </Text>
        )}
      </View>

      {/* ECHOCARDIOGRAPHIC FINDINGS */}
      <View style={styles.compactSection}>
        <Text style={styles.sectionTitle}>ACHADOS ECOCARDIOGRÁFICOS</Text>
        <Text style={styles.paragraph}>
          <Text style={{fontWeight: 'bold'}}>Válvula aórtica: </Text>
          {hasCalcification ? (
            `Evidência de calcificação valvular aórtica. Depósitos calcificados observados em ${calcificationPercentage}% dos frames analisados, sugerindo ${calcificationPercentage > 50 ? 'calcificação moderada a severa' : 'calcificação ligeira a moderada'}.`
          ) : (
            'Válvula aórtica com morfologia preservada, sem evidência de calcificação significativa nos frames analisados.'
          )}
        </Text>
        
        {hasCalcification && (
          <Text style={styles.paragraph}>
            A calcificação valvular pode associar-se a diferentes graus de obstrução, exigindo correlação com dados hemodinâmicos para avaliação completa.
          </Text>
        )}
      </View>      {/* Binary Classification Analysis - REDUCED */}
      <View style={styles.compactSection}>
        <Text style={styles.sectionTitle}>ANÁLISE DE CLASSIFICAÇÃO BINÁRIA</Text>
        <Text style={styles.paragraph}>
          Sistema automático de classificação para deteção de calcificação valvular:
        </Text>
        
        {data.slice(0, Math.min(data.length, 4)).map((frame, index) => {
          if (!frame.rects || frame.rects.length === 0) return null;
          
          const confidence = frame.confidence ? parseFloat(frame.confidence) : 0;
          const isAIGenerated = frame.is_calcification_generated;
          
          return (
            <View key={index} style={styles.findingItem}>
              <Text style={styles.findingBullet}>•</Text>
              <Text style={styles.findingText}>
                Frame {index + 1}: {frame.is_calcified ? 'CALCIFICADA' : 'NÃO CALCIFICADA'} 
                {confidence > 0 && (
                  <Text> - {confidence.toFixed(1)}%</Text>
                )}
                {isAIGenerated && (
                  <Text style={{fontSize: 7, color: '#6C7A72'}}> (IA)</Text>
                )}
              </Text>
            </View>
          );
        })}
        
        {data.length > 4 && (
          <Text style={{fontSize: 8, color: '#6C7A72', marginTop: 4}}>
            ... e mais {data.length - 4} frames analisados
          </Text>
        )}
      </View>

      <View style={styles.divider} />

      {/* Conclusion */}
      <View style={styles.conclusion}>
        <Text style={styles.sectionTitle}>CONCLUSÃO</Text>
        <Text style={styles.paragraph}>
          {hasCalcification ? (
            `Ecocardiograma demonstra calcificação da válvula aórtica em ${calcificationPercentage}% dos frames analisados. Recomenda-se avaliação hemodinâmica complementar e seguimento cardiológico.`
          ) : (
            'Ecocardiograma com válvula aórtica de aspeto normal, sem evidência de calcificação significativa no momento do exame.'
          )}
        </Text>
      </View>

      {reportText && (
        <View style={styles.compactSection}>
          <Text style={styles.sectionTitle}>OBSERVAÇÕES DO CLÍNICO</Text>
          <Text style={styles.paragraph}>{reportText}</Text>
        </View>
      )}

      {/* Signature */}
      <View style={styles.signature}>
        <Text>____________________________________</Text>
        <Text style={{fontWeight: 'bold', marginTop: 6, fontSize: 10}}>
          Dr. {medico.first_name} {medico.last_name}
        </Text>
        <Text style={{fontSize: 9, marginTop: 2}}>Cardiologista</Text>
        <Text style={{fontSize: 7, marginTop: 8, color: '#6C7A72'}}>
          Relatório gerado com assistência de IA - CalciVision
        </Text>
      </View>
    </Page>
  </Document>
);
};

export default ReportPDF;
