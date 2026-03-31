module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  try {
    return res.status(200).json({received:true});
  } catch (error) {
    return res.status(400).send('Error: ' + error.message);
  }
};
